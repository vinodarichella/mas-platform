from fastapi import APIRouter
from pydantic import BaseModel

from engine.agent_factory import AgentFactory, PROVIDER_MODELS

router = APIRouter(tags=["agents"])


class ValidateRequest(BaseModel):
    agent_config: dict


@router.post("/validate")
async def validate_agent(req: ValidateRequest):
    errors = AgentFactory.validate_config(req.agent_config)
    return {"valid": len(errors) == 0, "errors": errors}


@router.get("/providers")
async def list_providers():
    """Return providers with their available models.
    'configured' = API keys present; 'all' = full model list for UI dropdowns.
    """
    return {
        "configured": AgentFactory.get_available_providers(),
        "all": PROVIDER_MODELS,
    }
