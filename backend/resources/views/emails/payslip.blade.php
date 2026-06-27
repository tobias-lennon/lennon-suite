<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    body { font-family: Arial, sans-serif; font-size: 14px; color: #1a1a1a; background: #f5f5f5; margin: 0; padding: 24px; }
    .card { background: #fff; border-radius: 8px; padding: 32px; max-width: 560px; margin: 0 auto; }
    .logo { display: inline-block; background: #0F3714; color: #97B545; font-size: 20px; font-weight: bold; letter-spacing: 2px; padding: 6px 14px; border-radius: 4px; margin-bottom: 20px; }
    h2 { color: #0F3714; margin: 0 0 12px; }
    p { color: #444; line-height: 1.6; margin: 0 0 12px; }
    .detail { background: #f9f9f9; border-radius: 6px; padding: 16px; margin: 20px 0; }
    .detail p { margin: 4px 0; }
    .net { font-size: 18px; font-weight: bold; color: #0F3714; }
    .footer { margin-top: 24px; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">LL</div>
    <h2>Hi {{ $payslip->employee->name }},</h2>
    <p>Please find your payslip for the week of
      <strong>{{ $payslip->payrollRun->period_start->format('d M') }} – {{ $payslip->payrollRun->period_end->format('d M Y') }}</strong>
      attached to this email.
    </p>
    <div class="detail">
      <p><strong>Pay date:</strong> {{ $payslip->payrollRun->pay_date->format('d M Y') }}</p>
      <p><strong>Hours:</strong> {{ number_format($payslip->hours_logged + $payslip->hours_extra, 2) }} hrs</p>
      <p><strong>Gross pay:</strong> €{{ number_format($payslip->gross_pay, 2) }}</p>
      <p class="net">Take-home: €{{ number_format($payslip->net_pay, 2) }}</p>
    </div>
    <p>If you have any questions about your pay, please get in touch.</p>
    <div class="footer">
      <p>Lennon Landscaping &mdash; this email was sent automatically from the Suite app.</p>
    </div>
  </div>
</body>
</html>
