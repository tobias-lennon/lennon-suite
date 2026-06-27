<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Payslip &mdash; {{ $payslip->employee->name }}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: DejaVu Sans, sans-serif;
      font-size: 10px;
      color: #1a1a1a;
      background: #ffffff;
    }

    .page { padding: 36px 40px; }

    /* ── Header ── */
    .header {
      width: 100%;
      margin-bottom: 24px;
      border-bottom: 3px solid #0F3714;
      padding-bottom: 18px;
    }
    .logo-block {
      display: inline-block;
      background: #0F3714;
      padding: 7px 13px 7px 11px;
      border-radius: 4px;
    }
    .logo-ll   { font-size: 20px; font-weight: bold; color: #97B545; letter-spacing: 2px; display: block; line-height: 1; }
    .logo-name { font-size: 7px; color: rgba(255,255,255,0.8); letter-spacing: 3px; text-transform: uppercase; display: block; margin-top: 2px; }
    .business-detail { font-size: 8px; color: #666; line-height: 1.7; margin-top: 5px; }

    .doc-type  { font-size: 28px; font-weight: bold; color: #0F3714; letter-spacing: 4px; text-transform: uppercase; line-height: 1; }
    .doc-right { text-align: right; vertical-align: top; }

    /* ── Info grid ── */
    .info-section { width: 100%; margin-bottom: 22px; }
    .info-left  { width: 55%; vertical-align: top; }
    .info-right { width: 45%; vertical-align: top; text-align: right; }

    .info-label { font-size: 7px; font-weight: bold; color: #888; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 2px; }
    .info-value { font-size: 10px; color: #1a1a1a; }
    .info-name  { font-size: 13px; font-weight: bold; color: #0F3714; }
    .info-ppsn  { font-size: 9px; color: #555; margin-top: 2px; font-family: DejaVu Sans Mono, monospace; }

    .divider { border: none; border-top: 1px solid #e0e0e0; margin: 16px 0; }

    /* ── Section header ── */
    .section-head {
      font-size: 7.5px;
      font-weight: bold;
      color: #0F3714;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      padding: 5px 0;
      border-bottom: 1px solid #0F3714;
      margin-bottom: 10px;
    }

    /* ── Earnings ── */
    .row { width: 100%; margin-bottom: 5px; }
    .row-label { width: 70%; color: #444; }
    .row-value { width: 30%; text-align: right; font-weight: bold; color: #1a1a1a; }
    .row-sub   { font-size: 8.5px; color: #888; }
    .row-total-label { width: 70%; font-weight: bold; color: #1a1a1a; padding-top: 4px; }
    .row-total-value { width: 30%; text-align: right; font-weight: bold; color: #1a1a1a; padding-top: 4px; }

    /* ── Net Pay ── */
    .net-box {
      background: #0F3714;
      border-radius: 4px;
      padding: 12px 16px;
      margin-top: 14px;
    }
    .net-label { font-size: 9px; color: rgba(255,255,255,0.65); text-transform: uppercase; letter-spacing: 1.5px; }
    .net-amount { font-size: 22px; font-weight: bold; color: #97B545; margin-top: 2px; }

    /* ── Employer note ── */
    .employer-box {
      background: #f7f7f7;
      border-left: 3px solid #97B545;
      padding: 8px 12px;
      margin-top: 14px;
      font-size: 8.5px;
      color: #555;
    }

    /* ── Warning ── */
    .warning {
      background: #fff8e1;
      border-left: 3px solid #f0ad00;
      padding: 8px 12px;
      margin-bottom: 14px;
      font-size: 8.5px;
      color: #664d00;
    }

    /* ── Footer ── */
    .footer {
      margin-top: 28px;
      border-top: 1px solid #e0e0e0;
      padding-top: 10px;
      text-align: center;
      font-size: 7.5px;
      color: #aaa;
    }
  </style>
</head>
<body>
<div class="page">

  {{-- Header --}}
  <table class="header" cellpadding="0" cellspacing="0">
    <tr>
      <td style="width:55%; vertical-align:top;">
        <div class="logo-block">
          <span class="logo-ll">LL</span>
          <span class="logo-name">Lennon Landscaping</span>
        </div>
        <div class="business-detail">
          @if($settings->address_line_1) {{ $settings->address_line_1 }}<br>@endif
          @if($settings->city) {{ $settings->city }}@if($settings->county), {{ $settings->county }}@endif<br>@endif
          @if($settings->company_phone) {{ $settings->company_phone }}<br>@endif
          @if($settings->vat_number) VAT: {{ $settings->vat_number }}@endif
        </div>
      </td>
      <td class="doc-right">
        <div class="doc-type">Payslip</div>
      </td>
    </tr>
  </table>

  {{-- Employee + period info --}}
  <table class="info-section" cellpadding="0" cellspacing="0">
    <tr>
      <td class="info-left">
        <div class="info-label">Employee</div>
        <div class="info-name">{{ ucwords(strtolower($payslip->employee->name), " \t\r\n\f\v'") }}</div>
        @if($payslip->employee->ppsn)
          <div class="info-ppsn">PPSN: {{ $payslip->employee->ppsn }}</div>
        @endif
      </td>
      <td class="info-right">
        <div style="margin-bottom:8px;">
          <div class="info-label">Pay Period</div>
          <div class="info-value">{{ $run->period_start->format('d M Y') }} &ndash; {{ $run->period_end->format('d M Y') }}</div>
        </div>
        <div>
          <div class="info-label">Pay Date</div>
          <div class="info-value" style="font-weight:bold;">{{ $run->pay_date->format('d M Y') }}</div>
        </div>
      </td>
    </tr>
  </table>

  @if(!$payslip->employee->std_rate_cutoff_weekly)
  <div class="warning">
    &#9888; RPN data not on file &mdash; tax figures are estimated at 0 credits / 0 cut-off. Update employee RPN details in Settings.
  </div>
  @endif

  {{-- Earnings --}}
  <div class="section-head">Earnings</div>

  @php
    $hoursTotal = $payslip->hours_logged + $payslip->hours_extra;
  @endphp

  <table class="row" cellpadding="0" cellspacing="0">
    <tr>
      <td class="row-label">
        Hours worked
        @if($payslip->hours_extra > 0)
          <br><span class="row-sub">
            Logged: {{ number_format($payslip->hours_logged, 2) }} hrs &nbsp;&middot;&nbsp;
            Additional: {{ number_format($payslip->hours_extra, 2) }} hrs
            @if($payslip->extra_description) ({{ $payslip->extra_description }})@endif
          </span>
        @else
          <span class="row-sub"> &mdash; {{ number_format($payslip->hours_logged, 2) }} hrs</span>
        @endif
      </td>
      <td class="row-value">{{ number_format($hoursTotal, 2) }} hrs</td>
    </tr>
  </table>

  <table class="row" cellpadding="0" cellspacing="0" style="margin-top:3px;">
    <tr>
      <td class="row-label">Rate of pay</td>
      <td class="row-value">&euro;{{ number_format($payslip->employee->pay_rate, 2) }}/hr</td>
    </tr>
  </table>

  <hr class="divider">

  <table class="row" cellpadding="0" cellspacing="0">
    <tr>
      <td class="row-total-label">Gross Pay</td>
      <td class="row-total-value">&euro;{{ number_format($payslip->gross_pay, 2) }}</td>
    </tr>
  </table>

  {{-- Deductions --}}
  <div class="section-head" style="margin-top:18px;">Deductions</div>

  <table class="row" cellpadding="0" cellspacing="0">
    <tr>
      <td class="row-label">PAYE (Income Tax)</td>
      <td class="row-value">&euro;{{ number_format($payslip->paye, 2) }}</td>
    </tr>
  </table>
  <table class="row" cellpadding="0" cellspacing="0">
    <tr>
      <td class="row-label">
        Employee PRSI
        <span class="row-sub">&mdash; {{ $payslip->gross_pay > 352 ? 'Class A1 (4%)' : 'Class A0 (exempt)' }}</span>
      </td>
      <td class="row-value">&euro;{{ number_format($payslip->prsi_employee, 2) }}</td>
    </tr>
  </table>
  <table class="row" cellpadding="0" cellspacing="0">
    <tr>
      <td class="row-label">
        USC
        <span class="row-sub">&mdash;
          @if($payslip->employee->usc_status === 'exempt') Exempt
          @elseif($payslip->employee->usc_status === 'reduced') Reduced (Medical Card)
          @else Standard Rates
          @endif
        </span>
      </td>
      <td class="row-value">&euro;{{ number_format($payslip->usc, 2) }}</td>
    </tr>
  </table>

  <hr class="divider">

  <table class="row" cellpadding="0" cellspacing="0">
    <tr>
      <td class="row-total-label">Total Deductions</td>
      <td class="row-total-value">&euro;{{ number_format($payslip->paye + $payslip->prsi_employee + $payslip->usc, 2) }}</td>
    </tr>
  </table>

  {{-- Net Pay --}}
  <div class="net-box">
    <div class="net-label">Take-Home Pay</div>
    <div class="net-amount">&euro;{{ number_format($payslip->net_pay, 2) }}</div>
  </div>

  {{-- Employer PRSI note --}}
  <div class="employer-box">
    <strong>Employer PRSI:</strong> &euro;{{ number_format($payslip->prsi_employer, 2) }}
    &mdash; this is Lennon Landscaping&rsquo;s PRSI contribution and is not deducted from your pay.
  </div>

  <div class="footer">
    Generated by Lennon Landscaping Suite &mdash; {{ now()->format('d M Y') }}
  </div>

</div>
</body>
</html>
