# SmartNotes Backend Skeleton

## Setup

Create and activate a virtual environment, then install the dependencies:

```text
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt
```

Run the development server with:

```text
uvicorn backend.app.main:app --reload
```

The current skeleton exposes only `/health` and authenticated `/me`. Firebase Admin token verification is required for `/me`; tests mock verification and never call Firebase.
