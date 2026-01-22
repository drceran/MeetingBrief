from fastapi import FastAPI

app = FastAPI(title="Meeting Notes AI Backend")

@app.get("/")
async def root():
    return {"message": "Meeting Notes AI Backend"}

# TODO: Add authentication, meeting endpoints, background tasks