from django.db import models

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

class Sprint(models.Model):
    name = models.CharField('迭代', max_length=64)
    start_date = models.DateField('开始日')
    end_date = models.DateField('结束日')
    is_active = models.BooleanField('当前迭代', default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = '迭代'
        verbose_name_plural = '迭代'
        ordering = ['-start_date']

    def __str__(self):
        return self.name

    @property
    def weeks(self):
        return (self.end_date - self.start_date).days / 7

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
    est_effort = models.FloatField('预计工时(h)', default=0)
    actual_effort = models.FloatField('实际工时(h)', default=0)
    assigned_sprint = models.ForeignKey(Sprint, on_delete=models.SET_NULL, null=True, blank=True, verbose_name='所属迭代')
    planned_start = models.DateField('预计开始', null=True, blank=True)
    planned_end = models.DateField('预计结束', null=True, blank=True)
    note = models.TextField('备注', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = '需求'
        verbose_name_plural = '需求'
        ordering = ['-created_at']

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
