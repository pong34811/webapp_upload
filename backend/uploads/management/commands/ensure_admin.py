import os
from django.core.management.base import BaseCommand
from django.contrib.auth.models import User


class Command(BaseCommand):
    help = 'Create or update admin superuser from environment variables (ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_EMAIL)'

    def handle(self, *args, **options):
        username = os.environ.get('ADMIN_USERNAME', 'admin')
        password = os.environ.get('ADMIN_PASSWORD', 'admin')
        email = os.environ.get('ADMIN_EMAIL', 'admin@example.com')

        user, created = User.objects.get_or_create(
            username=username,
            defaults={'email': email, 'is_staff': True, 'is_superuser': True},
        )

        if not created:
            user.set_password(password)
            user.is_staff = True
            user.is_superuser = True
            user.email = email
            user.save()
            self.stdout.write(self.style.WARNING(f'Updated existing user "{username}"'))
        else:
            self.stdout.write(self.style.SUCCESS(f'Created superuser "{username}"'))
