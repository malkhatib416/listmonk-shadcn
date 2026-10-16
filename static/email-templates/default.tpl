<!doctype html>
<html>
    <head>
        <title>{{ .Campaign.Subject }}</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1, minimum-scale=1">
        <base target="_blank">
        <style>
            body {
                background-color: #f1f5f9;
                font-family: 'Helvetica Neue', 'Segoe UI', Helvetica, sans-serif;
                font-size: 15px;
                line-height: 26px;
                margin: 0;
                color: #444;
            }

            pre {
                background: #f4f4f4f4;
                padding: 2px;
            }

            table {
                width: 100%;
                border: 1px solid #ddd;
            }
            table td {
                border-color: #ddd;
                padding: 5px;
            }

            .wrap {
                background-color: #fff;
                padding: 30px;
                max-width: 525px;
                margin: 0 auto;
                border-radius: 5px;
            }

            .button {
                background: #1a3680;
                border-radius: 3px;
                text-decoration: none !important;
                color: #fff !important;
                font-weight: bold;
                padding: 10px 30px;
                display: inline-block;
            }
            .button:hover {
                background: #111;
            }

            .footer {
                text-align: center;
                font-size: 12px;
                color: #888;
            }
                .footer a {
                    color: #888;
                    margin-right: 5px;
                }

            .gutter {
                padding: 30px;
            }

            img {
                max-width: 100%;
                height: auto;
            }

            a {
                color: #1a3680;
            }
                a:hover {
                    color: #111;
                }
            @media screen and (max-width: 600px) {
                .wrap {
                    max-width: auto;
                }
                .gutter {
                    padding: 10px;
                }
            }
        </style>
    </head>
<body style="background-color: #f1f5f9;font-family: 'Helvetica Neue', 'Segoe UI', Helvetica, sans-serif;font-size: 15px;line-height: 26px;margin: 0;color: #444;">
    <div class="gutter" style="padding: 30px;">&nbsp;</div>
    <div class="wrap" style="background-color: #fff;padding: 30px;max-width: 525px;margin: 0 auto;border-radius: 5px;">
        <div style="padding-bottom: 18px;margin-bottom: 24px;border-bottom: 1px solid #e2e8f0;">
            <a href="https://alertjo.fr" style="text-decoration: none;"><img src="https://alertjo.fr/logo.png" alt="AlertJO" width="150" style="display: block;border: 0;width: 150px;max-width: 150px;height: auto;"></a>
        </div>
        {{ template "content" . }}
    </div>
    
    <div class="footer" style="text-align: center;font-size: 12px;color: #888;">
        <p>
            <a href="{{ UnsubscribeURL }}" style="color: #888;">{{ L.T "email.unsub" }}</a>
            &nbsp;&nbsp;
            <a href="{{ MessageURL }}" style="color: #888;">{{ L.T "email.viewInBrowser" }}</a>
        </p>
    </div>
    <div class="gutter" style="padding: 30px;">&nbsp;{{ TrackView }}</div>
</body>
</html>
