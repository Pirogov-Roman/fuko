from django.contrib import admin
from django.urls import path
from django.views.generic import TemplateView
from pendulum.views import simulate
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Главная страница с HTML-шаблоном
    path('', TemplateView.as_view(template_name='pendulum/index.html'), name='index'),
    
    # API endpoint для симуляции
    path('simulate/', simulate, name='simulate'),
]

# Добавляем обработку статических файлов в режиме разработки
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)