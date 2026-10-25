"""Create the first administrator for a fresh workspace."""

from getpass import getpass

from sqlalchemy import select

from app.database import SessionLocal
from app.models import Role, User
from app.security import hash_password


def main() -> None:
    with SessionLocal() as db:
        if db.scalar(select(User.id).where(User.role == Role.ADMIN).limit(1)) is not None:
            raise SystemExit("An administrator already exists. Sign in and manage accounts from Team access.")
        name = input("Administrator name: ").strip()
        email = input("Administrator email: ").strip().lower()
        password = getpass("Choose a password (at least 12 characters): ")
        confirm = getpass("Confirm password: ")
        if len(name) < 2 or len(password) < 12 or password != confirm:
            raise SystemExit("Name/password is invalid or the passwords do not match; no account was created.")
        user = db.scalar(select(User).where(User.email == email))
        if user:
            user.name = name
            user.password_hash = hash_password(password)
            user.role = Role.ADMIN
        else:
            db.add(User(name=name, email=email, password_hash=hash_password(password), role=Role.ADMIN))
        db.commit()
        print(f"Administrator account is ready for {email}.")


if __name__ == "__main__":
    main()
