from collections.abc import Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models import Role, User

bearer = HTTPBearer(auto_error=False)
ALGORITHM = "HS256"


def current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), db: Session = Depends(get_db)) -> User:
    unauthorized = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Valid bearer token required", headers={"WWW-Authenticate": "Bearer"})
    if credentials is None or not settings.jwt_secret_key:
        raise unauthorized
    try:
        claims = jwt.decode(credentials.credentials, settings.jwt_secret_key, algorithms=[ALGORITHM])
        user_id = int(claims.get("sub", ""))
    except (JWTError, ValueError, TypeError):
        raise unauthorized
    user = db.get(User, user_id)
    if user is None:
        raise unauthorized
    return user


def require_roles(*roles: Role) -> Callable:
    def check_role(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient role")
        return user
    return check_role
