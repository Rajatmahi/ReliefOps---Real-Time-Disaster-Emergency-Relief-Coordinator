from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models import IncidentStatus, Severity


class IncidentCreate(BaseModel):
    disaster_type: str = Field(min_length=2, max_length=60)
    description: str = Field(min_length=10, max_length=5000)
    location_label: str | None = Field(default=None, min_length=2, max_length=255)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    severity: Severity
    people_affected: int | None = Field(default=None, ge=0, le=1000000)
    people_trapped: int = Field(default=0, ge=0, le=1000000)
    urgent_medical: bool = False
    immediate_needs: list[str] = Field(default_factory=list, max_length=12)

    @field_validator("immediate_needs")
    @classmethod
    def validate_needs(cls, value):
        allowed = {"rescue", "medical", "food", "water", "shelter", "evacuation", "engineering", "other"}
        if any(item not in allowed for item in value):
            raise ValueError("Unsupported immediate need")
        return value


class IncidentStatusUpdate(BaseModel):
    status: IncidentStatus
    reason: str | None = Field(default=None, max_length=2000)


class IncidentRead(BaseModel):
    id: int
    reporter_id: int
    disaster_type: str
    description: str
    location_label: str | None
    latitude: float
    longitude: float
    severity: Severity
    people_affected: int | None
    people_trapped: int
    urgent_medical: bool
    immediate_needs: list[str]
    suggested_severity: Severity | None
    priority_reasons: list[str]
    priority_override_reason: str | None
    resolution_notes: str | None
    status: IncidentStatus
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class StatusHistoryRead(BaseModel):
    id: int
    old_status: IncidentStatus | None
    new_status: IncidentStatus
    changed_by: int
    changed_at: datetime
    reason: str | None
    model_config = ConfigDict(from_attributes=True)
