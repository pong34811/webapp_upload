from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from rest_framework.authtoken.models import Token


class Command(BaseCommand):
    help = 'Auto-create superuser admin on startup'

    def handle(self, *args, **options):
        username = 'admin'
        password = '@0804547372Za$'
        email = 'admin@example.com'

        user, created = User.objects.get_or_create(
            username=username,
            defaults={'email': email, 'is_staff': True, 'is_superuser': True},
        )

        # Always reset password to ensure it's correct
        user.set_password(password)
        user.is_staff = True
        user.is_superuser = True
        user.email = email
        user.save()

        token, _ = Token.objects.get_or_create(user=user)

        if created:
            self.stdout.write(self.style.SUCCESS(f'Created superuser "{username}"'))
        else:
            self.stdout.write(self.style.WARNING(f'Updated superuser "{username}" password'))
        self.stdout.write(f'Token: {token.key}')
