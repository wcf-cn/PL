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
