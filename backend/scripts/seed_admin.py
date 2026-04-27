import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import delete, select

from app.config import settings
from app.database import AsyncSessionLocal, Base, engine
from app.models import Admin
from app.services.auth import hash_password


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as session:
        username = settings.admin_username.strip()
        password = settings.admin_password

        if not username or not password:
            print("ADMIN_USERNAME or ADMIN_PASSWORD is not set in backend/.env; skipped admin seed")
            return

        result = await session.execute(select(Admin).where(Admin.username == username))
        existing = result.scalar_one_or_none()

        if existing:
            existing.password_hash = await hash_password(password)
            print("Admin user updated")
        else:
            admin = Admin(username=username, password_hash=await hash_password(password))
            session.add(admin)
            print("Admin user created")

        await session.execute(delete(Admin).where(Admin.username != username))
        await session.commit()


if __name__ == "__main__":
    asyncio.run(seed())
