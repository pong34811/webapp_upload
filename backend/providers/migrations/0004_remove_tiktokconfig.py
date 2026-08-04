# Generated manually: TikTokConfig was never referenced by any code.

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("providers", "0003_facebookconfig_tiktokconfig_youtubeconfig_and_more"),
    ]

    operations = [
        migrations.DeleteModel(
            name="TikTokConfig",
        ),
    ]
