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
