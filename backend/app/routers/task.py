from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.deps import get_current_user, get_db
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskUpdate, TaskOut
from typing import List

router = APIRouter(prefix="/tasks", tags=["Tasks"])

@router.get("/me", response_model=List[TaskOut])
def get_my_tasks(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user),
):
    tasks = db.query(Task).filter(Task.user_id == str(current_user.user_id)).all()
    return tasks

@router.get("/{task_id}", response_model=TaskOut)
def get_task(task_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == str(current_user.user_id)).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task

@router.post("/", response_model=TaskOut, status_code=status.HTTP_201_CREATED)
def create_task(task_in: TaskCreate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    task = Task(
        user_id=str(current_user.user_id),
        title=task_in.title,
        description=task_in.description,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task

@router.put("/{task_id}", response_model=TaskOut)
def update_task(task_id: int, task_in: TaskUpdate, db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    task = db.query(Task).filter(Task.id == task_id, Task.user_id == str(current_user.user_id)).first()
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    if task_in.title is not None:
        task.title = task_in.title
    if task_in.description is not None:
        task.description = task_in.description
    if task_in.status is not None:
        task.status = task_in.status
    db.commit()
    db.refresh(task)
    return task
