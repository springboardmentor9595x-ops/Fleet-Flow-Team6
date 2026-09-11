import enum

class TaskStatus(str, enum.Enum):
    OPEN = "OPEN"
    ASSIGNED = "ASSIGNED"
    COMPLETED = "COMPLETED"
