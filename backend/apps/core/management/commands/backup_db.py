import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = '备份 SQLite 数据库到 backups/ 目录, 自动保留最近 N 份'

    def add_arguments(self, parser):
        parser.add_argument('--keep', type=int, default=30, help='保留份数(默认 30)')
        parser.add_argument('--dir', type=str, default=None, help='备份目录(默认 backend/backups)')

    def handle(self, *args, **opts):
        db_path = Path(settings.DATABASES['default']['NAME'])
        backup_dir = Path(opts['dir']) if opts['dir'] else db_path.parent / 'backups'
        backup_dir.mkdir(parents=True, exist_ok=True)

        # ponytail: 用 sqlite3 backup API 拿一致快照, 避免 shutil.copy 拷到半截写入
        stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
        dest = backup_dir / f'db-{stamp}.sqlite3'
        src = sqlite3.connect(str(db_path))
        dst = sqlite3.connect(str(dest))
        try:
            src.backup(dst)
        finally:
            dst.close()
            src.close()

        backups = sorted(backup_dir.glob('db-*.sqlite3'))
        for old in backups[:-opts['keep']]:
            old.unlink()

        self.stdout.write(self.style.SUCCESS(
            f'备份完成: {dest} (目录共 {len(backups)} 份, 保留最近 {opts["keep"]} 份)'
        ))
