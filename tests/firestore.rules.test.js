import { readFileSync } from 'node:fs';
import { beforeAll, afterAll, afterEach, test } from 'node:test';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, writeBatch } from 'firebase/firestore';

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
let testEnv;

const user = (uid, emailVerified = true) => testEnv.authenticatedContext(uid, { email_verified: emailVerified });
const note = (uid = 'uploader') => ({ uploaderId: uid, size: 100, title: 'Valid title' });

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({ projectId: 'smartnotes-rules-test', firestore: { rules } });
});
afterAll(async () => testEnv?.cleanup());
afterEach(async () => testEnv?.clearFirestore());

test('public metadata and protected chunks', async () => {
  await testEnv.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), 'notes/n1'), note()));
  await assertSucceeds(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'notes/n1')));
  await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'notes/n1/chunks/0')));
  await assertSucceeds(getDoc(doc(user('uploader').firestore(), 'notes/n1/chunks/0')));
});

test('note creation requires verified owner and valid metadata', async () => {
  await assertFails(user('uploader', false).firestore().doc('notes/n1').set(note()));
  await assertSucceeds(user('uploader').firestore().doc('notes/n1').set(note()));
});

test('chunk indexes, size, and fields are restricted', async () => {
  const db = user('uploader').firestore();
  await testEnv.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), 'notes/n1'), note()));
  await assertSucceeds(db.doc('notes/n1/chunks/0').set({ data: 'x', index: 0 }));
  await assertSucceeds(db.doc('notes/n1/chunks/14').set({ data: 'x', index: 14 }));
  await assertFails(db.doc('notes/n1/chunks/15').set({ data: 'x', index: 15 }));
  await assertFails(db.doc('notes/n1/chunks/-1').set({ data: 'x', index: -1 }));
  await assertFails(db.doc('notes/n1/chunks/1').set({ data: 'x', index: 1, extra: true }));
});

test('uploader can delete note and chunks in one batch', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'notes/n1'), note());
    await setDoc(doc(db, 'notes/n1/chunks/0'), { data: 'x', index: 0 });
  });
  const db = user('uploader').firestore();
  const batch = writeBatch(db);
  batch.delete(doc(db, 'notes/n1/chunks/0'));
  batch.delete(doc(db, 'notes/n1'));
  await assertSucceeds(batch.commit());
});

test('non-uploader cannot delete note or chunks; ownership fields cannot change', async () => {
  await testEnv.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), 'notes/n1'), note()));
  const other = user('other').firestore();
  await assertFails(deleteDoc(doc(other, 'notes/n1')));
  await assertFails(deleteDoc(doc(other, 'notes/n1/chunks/0')));
  const db = user('uploader').firestore();
  await assertFails(db.doc('notes/n1').set({ uploaderId: 'other', size: 100, title: 'Valid title' }));
  await assertFails(db.doc('notes/n1').set({ uploaderId: 'uploader', size: 200, title: 'Valid title' }));
});

const conversation = { participants: ['a', 'b'] };
test('conversation participants control messages and immutable fields', async () => {
  await testEnv.withSecurityRulesDisabled(async context => setDoc(doc(context.firestore(), 'conversations/c1'), conversation));
  const a = user('a').firestore();
  const other = user('c').firestore();
  await assertSucceeds(a.doc('conversations/c1/messages/m1').set({ senderId: 'a', text: 'hi' }));
  await assertFails(a.doc('conversations/c1/messages/m2').set({ senderId: 'b', text: 'spoof' }));
  await assertFails(other.doc('conversations/c1').get());
  await assertFails(other.doc('conversations/c1/messages/m3').set({ senderId: 'c', text: 'no' }));
  await assertFails(a.doc('conversations/c1/messages/m1').update({ text: 'edited' }));
  await assertFails(a.doc('conversations/c1/messages/m1').delete());
  await assertFails(a.doc('conversations/c1').update({ participants: ['a', 'c'] }));
});
