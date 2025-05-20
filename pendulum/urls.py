from django.urls import path
from pendulum.views import index, simulate

urlpatterns = [
    path('', index, name='index'),
    path('simulate/', simulate, name='simulate'),
]