from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator

class Member(models.Model):
    name = models.CharField('姓名', max_length=64)
    week_capacity = models.FloatField('周容量(人时)', default=40)
    modules = models.CharField('负责模块', max_length=128, blank=True,
                               help_text='逗号分隔,如 后端,前端')
    active = models.BooleanField('在职', default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '成员'
        verbose_name_plural = '成员'

    def __str__(self):
        return self.name


class Requirement(models.Model):
    STATUS_BACKLOG = 'backlog'
    STATUS_SCHEDULED = 'scheduled'
    STATUS_IN_PROGRESS = 'in_progress'
    STATUS_TESTING = 'testing'
    STATUS_DONE = 'done'
    STATUS_BLOCKED = 'blocked'
    STATUS_PAUSED = 'paused'
    STATUS_CHOICES = [
        (STATUS_BACKLOG, '待评审'),
        (STATUS_SCHEDULED, '排期中'),
        (STATUS_IN_PROGRESS, '开发中'),
        (STATUS_TESTING, '测试中'),
        (STATUS_DONE, '已上线'),
        (STATUS_BLOCKED, '已阻塞'),
        (STATUS_PAUSED, '暂停'),
    ]
    PRIORITY_CHOICES = [('P0', 'P0'), ('P1', 'P1'), ('P2', 'P2')]

    title = models.CharField('标题', max_length=200)
    status = models.CharField('状态', max_length=20, choices=STATUS_CHOICES, default=STATUS_BACKLOG)
    priority = models.CharField('优先级', max_length=4, choices=PRIORITY_CHOICES, default='P1')
    assignee = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='负责人')
    module = models.CharField('模块', max_length=64, blank=True)
    progress = models.IntegerField('进度%', default=0)
    last_status_change_at = models.DateTimeField('状态变更时间', null=True, blank=True)
    est_effort = models.FloatField('预计工时(h)', default=0, validators=[MinValueValidator(0)])
    actual_effort = models.FloatField('实际工时(h)', default=0, validators=[MinValueValidator(0)])
    planned_start = models.DateField('预计开始', null=True, blank=True)
    planned_end = models.DateField('预计结束', null=True, blank=True)
    note = models.TextField('备注', blank=True)
    parent = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True,
                               related_name='children', verbose_name='父需求')
    blocked_by = models.ManyToManyField('self', symmetrical=False, blank=True, verbose_name='被阻塞于')
    version = models.ForeignKey('Version', on_delete=models.SET_NULL, null=True, blank=True,
                                related_name='requirements', verbose_name='目标版本')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '需求'
        verbose_name_plural = '需求'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        # done 完成定义:已上线 → 进度强制 100
        if self.status == self.STATUS_DONE:
            self.progress = 100
        # 状态变更历史:检测 status 变化才刷新时间戳
        if self.pk:
            old = Requirement.objects.filter(pk=self.pk).only('status').first()
            if old and old.status != self.status:
                self.last_status_change_at = timezone.now()
        elif self.last_status_change_at is None:
            self.last_status_change_at = timezone.now()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.title


class Milestone(models.Model):
    requirement = models.ForeignKey(Requirement, on_delete=models.CASCADE, verbose_name='需求')
    title = models.CharField('标题', max_length=200)
    date = models.DateField('日期')
    note = models.TextField('备注', blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '里程碑'
        verbose_name_plural = '里程碑'
        ordering = ['-date']

    def __str__(self):
        return self.title


class MemberDailySnapshot(models.Model):
    date = models.DateField('日期')
    member = models.ForeignKey(Member, on_delete=models.CASCADE, verbose_name='成员')
    remaining_effort = models.FloatField('剩余工时(h)', default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('date', 'member')
        ordering = ['-date']
        verbose_name = '每日工时快照'
        verbose_name_plural = '每日工时快照'

    def __str__(self):
        return f'{self.member.name} {self.date} 剩余{self.remaining_effort}h'


class Version(models.Model):
    name = models.CharField('版本', max_length=64)
    integration_date = models.DateField('联调日', null=True, blank=True)
    freeze_date = models.DateField('封板日', null=True, blank=True)
    test_date = models.DateField('转测日', null=True, blank=True)
    release_date = models.DateField('发布日', null=True, blank=True)
    note = models.TextField('备注', blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '版本'
        verbose_name_plural = '版本'
        ordering = ['-release_date', '-created_at']

    def __str__(self):
        return self.name

    @property
    def current_phase(self):
        today = timezone.now().date()
        if self.release_date and today >= self.release_date:
            return '已发布'
        if self.test_date and today >= self.test_date:
            return '转测中'
        if self.freeze_date and today >= self.freeze_date:
            return '封板'
        if self.integration_date and today >= self.integration_date:
            return '联调中'
        return '规划中'
