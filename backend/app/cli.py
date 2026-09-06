import sys
import asyncio
from app.core.database import engine, AsyncSessionLocal, Base
from app.repositories.admin_repo import AdminRepository


async def create_admin(username: str, email: str, password: str):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        repo = AdminRepository(db)
        existing = await repo.get_by_username(username)
        if existing:
            print(f"ERROR: Administrator '{username}' already exists.")
            sys.exit(1)

        existing_email = await repo.get_by_email(email)
        if existing_email:
            print(f"ERROR: Administrator with email '{email}' already exists.")
            sys.exit(1)

        admin = await repo.create(
            username=username,
            email=email,
            password=password,
            role="super_admin"
        )
        await db.commit()
        print(f"SUCCESS: Super Administrator '{admin.username}' created successfully.")


def main():
    if len(sys.argv) < 2:
        print("Usage: python -m app.cli create-admin <username> <email> <password>")
        sys.exit(1)

    command = sys.argv[1]
    if command == "create-admin":
        if len(sys.argv) != 5:
            print("Usage: python -m app.cli create-admin <username> <email> <password>")
            sys.exit(1)
        username = sys.argv[2]
        email = sys.argv[3]
        password = sys.argv[4]
        asyncio.run(create_admin(username, email, password))
    else:
        print(f"Unknown command: {command}")
        sys.exit(1)


if __name__ == "__main__":
    main()
