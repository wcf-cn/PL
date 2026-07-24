from django.core.management.base import BaseCommand
from apps.core.digest import send_digest


class Command(BaseCommand):
    help = '发送每日风险摘要(推送到个人微信 webhook / 邮件)'

    def handle(self, *args, **opts):
        send_digest()
        self.stdout.write(self.style.SUCCESS('每日风险摘要已处理'))
