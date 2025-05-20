from django.db import models

class Pendulum(models.Model):
    length = models.FloatField(verbose_name="Длина нити (м)")
    initial_angle = models.FloatField(verbose_name="Начальный угол (°)")
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Маятник {self.id}: {self.length}м, {self.initial_angle}°"