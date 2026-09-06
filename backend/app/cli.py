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
            print(f"ERROR: Administrator '{username}' already exists. Use 'reset-password' to update their password.")
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


async def reset_password(username: str, new_password: str):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        repo = AdminRepository(db)
        admin = await repo.get_by_username(username)
        if not admin:
            # Try searching by email
            admin = await repo.get_by_email(username)
        if not admin:
            print(f"ERROR: Administrator '{username}' not found.")
            sys.exit(1)

        await repo.update_password(admin, new_password)
        await db.commit()
        print(f"SUCCESS: Password for Administrator '{admin.username}' ({admin.email}) has been successfully reset.")


async def list_admins():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        repo = AdminRepository(db)
        admins = await repo.list_all()
        if not admins:
            print("No administrator accounts currently found in database.")
            return

        print(f"\nFound {len(admins)} Administrator(s):")
        print("-" * 65)
        for a in admins:
            print(f" • Username: {a.username:<15} | Email: {a.email:<25} | Role: {a.role}")
        print("-" * 65)


def main():
    if len(sys.argv) < 2:
        print("\nCorporate Mail Platform - Administrator CLI")
        print("Usage:")
        print("  python -m app.cli create-admin <username> <email> <password>")
        print("  python -m app.cli reset-password <username-or-email> <new-password>")
        print("  python -m app.cli list-admins\n")
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
    elif command == "reset-password":
        if len(sys.argv) != 4:
            print("Usage: python -m app.cli reset-password <username-or-email> <new-password>")
            sys.exit(1)
        username = sys.argv[2]
        new_password = sys.argv[3]
        asyncio.run(reset_password(username, new_password))
    elif command == "list-admins":
        asyncio.run(list_admins())
    else:
        print(f"Unknown command: '{command}'")
        print("Available commands: create-admin, reset-password, list-admins")
        sys.exit(1)


if __name__ == "__main__":
    main()
