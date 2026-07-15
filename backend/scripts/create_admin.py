"""Bootstrap or promote an admin user directly in the database.

Usage (run from backend/, with venv active):
    python scripts/create_admin.py --email admin@example.com --password secret --name "Admin Name"

If a user with that email already exists, it's promoted to admin/reactivated
and the password is updated instead of failing.
"""

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.database import async_session
from app.models.user import User
from app.services.auth_service import get_user_by_email, hash_password
from sqlalchemy import select


async def create_or_promote_admin(email: str, password: str, full_name: str, role: str) -> None:
    async with async_session() as db:
        user = await get_user_by_email(db, email)
        if user:
            user.password_hash = hash_password(password)
            user.full_name = full_name
            user.role = role
            user.is_active = True
            action = "Updated"
        else:
            user = User(
                email=email,
                password_hash=hash_password(password),
                full_name=full_name,
                role=role,
                is_active=True,
            )
            db.add(user)
            action = "Created"
        await db.commit()
        print(f"{action} {role} user: {email}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or promote an admin user")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--name", required=True, dest="full_name")
    parser.add_argument("--role", default="superadmin", choices=["admin", "superadmin"])
    args = parser.parse_args()

    if len(args.password) < 6:
        print("Password must be at least 6 characters.", file=sys.stderr)
        sys.exit(1)

    asyncio.run(create_or_promote_admin(args.email, args.password, args.full_name, args.role))


if __name__ == "__main__":
    main()
