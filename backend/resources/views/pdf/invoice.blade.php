<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>{{ $type === 'receipt' ? 'Receipt' : 'Invoice' }} {{ $invoice->invoice_number }}</title>
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
      margin-bottom: 28px;
      border-bottom: 3px solid #0F3714;
      padding-bottom: 20px;
    }
    .header-inner { width: 100%; }
    .logo-cell    { width: 55%; vertical-align: top; }
    .doc-type-cell { width: 45%; vertical-align: top; text-align: right; }

    .logo-block {
      display: inline-block;
      background: #0F3714;
      padding: 8px 14px 8px 12px;
      border-radius: 4px;
      margin-bottom: 8px;
    }
    .logo-ll {
      font-size: 22px;
      font-weight: bold;
      color: #97B545;
      letter-spacing: 2px;
      display: block;
      line-height: 1;
    }
    .logo-name {
      font-size: 7px;
      color: rgba(255,255,255,0.85);
      letter-spacing: 3px;
      text-transform: uppercase;
      display: block;
      margin-top: 3px;
    }
    .business-detail {
      font-size: 8.5px;
      color: #555;
      line-height: 1.7;
      margin-top: 4px;
    }
    .doc-type {
      font-size: 32px;
      font-weight: bold;
      color: #0F3714;
      letter-spacing: 4px;
      text-transform: uppercase;
      line-height: 1;
    }
    .invoice-number {
      font-size: 13px;
      font-weight: bold;
      color: #97B545;
      margin-top: 4px;
    }

    /* ── Bill To / Invoice Info ── */
    .meta-section  { width: 100%; margin-bottom: 24px; }
    .bill-to-cell  { width: 55%; vertical-align: top; }
    .invoice-info-cell { width: 45%; vertical-align: top; text-align: right; }

    .section-label {
      font-size: 7.5px;
      font-weight: bold;
      color: #97B545;
      text-transform: uppercase;
      letter-spacing: 1.5px;
      margin-bottom: 5px;
    }
    .customer-name {
      font-size: 13px;
      font-weight: bold;
      color: #0F3714;
      margin-bottom: 2px;
    }
    .address-line { font-size: 9px; color: #444; line-height: 1.6; }
    .job-ref      { font-size: 9px; color: #666; margin-top: 8px; font-style: italic; }

    .info-table   { font-size: 9px; width: 100%; }
    .info-table td { padding: 2px 0; line-height: 1.6; }
    .info-label   { color: #888; text-align: right; padding-right: 10px; width: 50%; }
    .info-value   { font-weight: bold; color: #1a1a1a; text-align: right; }

    /* ── Line Items Table ── */
    .items-table { width: 100%; border-collapse: collapse; margin-bottom: 0; }
    .items-table thead tr { background: #0F3714; color: white; }
    .items-table thead th {
      padding: 8px 10px;
      font-size: 8px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 1px;
      text-align: left;
    }
    .items-table thead th.right { text-align: right; }
    .items-table tbody tr { border-bottom: 1px solid #f3f4f6; }
    .items-table tbody tr.labour-row   { background: #ffffff; }
    .items-table tbody tr.material-row { background: #f9fafb; }
    .items-table tbody td {
      padding: 7px 10px;
      font-size: 9.5px;
      color: #1a1a1a;
      vertical-align: top;
    }
    .items-table tbody td.right { text-align: right; }
    .items-table tbody td.muted { color: #6b7280; }

    .pill-cell {
      width: 1%;
      white-space: nowrap;
      vertical-align: middle;
      padding-left: 7px;
    }
    .type-pill {
      display: inline-block;
      font-size: 6.5px;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      padding: 2px 5px;
      border-radius: 3px;
    }
    .pill-labour   { background: #dcfce7; color: #15803d; }
    .pill-material { background: #fef3c7; color: #92400e; }

    /* ── Totals ── */
    .totals-wrapper { width: 100%; margin-top: 0; }
    .totals-spacer  { width: 55%; vertical-align: top; }
    .totals-block   { width: 45%; vertical-align: top; }
    .totals-table   { width: 100%; border-collapse: collapse; }
    .totals-table td { padding: 5px 10px; font-size: 9.5px; }
    .totals-table .t-label { color: #555; text-align: left; }
    .totals-table .t-value { text-align: right; font-weight: bold; color: #1a1a1a; }
    .totals-table .discount-row td { color: #dc2626; }
    .total-due-row { background: #0F3714; }
    .total-due-row td {
      color: white !important;
      font-size: 11px !important;
      font-weight: bold !important;
      padding: 9px 10px !important;
    }
    .total-due-row .t-value {
      color: #97B545 !important;
      font-size: 13px !important;
    }

    /* ── Payment Section ── */
    .payment-section {
      margin-top: 24px;
      border-top: 1px solid #e5e7eb;
      padding-top: 16px;
    }
    .payment-grid         { width: 100%; }
    .payment-terms-cell   { width: 55%; vertical-align: top; }
    .payment-notes-cell   { width: 45%; vertical-align: top; text-align: right; padding-left: 16px; }

    .payment-box {
      background: #f0fdf4;
      border: 1.5px solid #86efac;
      border-radius: 6px;
      padding: 10px 14px;
      display: inline-block;
      text-align: left;
      width: 100%;
    }
    .payment-box-label {
      font-size: 7.5px;
      font-weight: bold;
      color: #15803d;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-bottom: 5px;
    }
    .payment-box-detail { font-size: 9px; color: #1a1a1a; line-height: 1.7; }
    .payment-box-amount { font-size: 15px; font-weight: bold; color: #0F3714; margin-top: 4px; }
    .variance-over  { font-size: 8px; color: #15803d; margin-top: 2px; }
    .variance-under { font-size: 8px; color: #dc2626; margin-top: 2px; }

    .bank-details { font-size: 8.5px; color: #555; line-height: 1.8; }
    .bank-details strong { color: #0F3714; }

    .notes-box {
      background: #f9fafb;
      border-left: 3px solid #97B545;
      padding: 8px 12px;
      font-size: 8.5px;
      color: #555;
      line-height: 1.6;
    }

    /* ── Footer ── */
    .footer {
      margin-top: 32px;
      border-top: 1px solid #e5e7eb;
      padding-top: 12px;
      width: 100%;
    }
    .footer-left  { width: 60%; vertical-align: middle; }
    .footer-right { width: 40%; vertical-align: middle; text-align: right; }
    .footer-thanks  { font-size: 9px; color: #97B545; font-weight: bold; }
    .footer-sub     { font-size: 7.5px; color: #aaa; margin-top: 2px; }
    .footer-website { font-size: 8px; color: #0F3714; font-weight: bold; }
  </style>
</head>
<body>
<div class="page">

  {{-- ── Header ── --}}
  <div class="header">
    <table class="header-inner" cellpadding="0" cellspacing="0">
      <tr>
        <td class="logo-cell">
          <div class="logo-block">
            <span class="logo-ll">LL</span>
            <span class="logo-name">Lennon Landscaping</span>
          </div>
          <div class="business-detail">
            Millstreet, Co. Cork<br>
            info@lennonlandscaping.ie &nbsp;·&nbsp; lennonlandscaping.ie<br>
            VAT Reg: IE8972984Q
          </div>
        </td>
        <td class="doc-type-cell">
          <div class="doc-type">{{ $type === 'receipt' ? 'Receipt' : 'Invoice' }}</div>
          <div class="invoice-number">{{ $invoice->invoice_number }}</div>
        </td>
      </tr>
    </table>
  </div>

  {{-- ── Bill To / Invoice Info ── --}}
  <table class="meta-section" cellpadding="0" cellspacing="0">
    <tr>
      <td class="bill-to-cell">
        <div class="section-label">Bill To</div>
        <div class="customer-name">{{ ucwords(strtolower($invoice->customer->name), " \t\r\n\f\v'") }}</div>

        @if($invoice->customer->address)
          @php $addr = $invoice->customer->address @endphp
          @if($addr->address_line_1)
            <div class="address-line">{{ ucwords(strtolower($addr->address_line_1), " \t\r\n\f\v'") }}</div>
          @endif
          @if($addr->address_line_2)
            <div class="address-line">{{ ucwords(strtolower($addr->address_line_2), " \t\r\n\f\v'") }}</div>
          @endif
          @if($addr->city)
            <div class="address-line">{{ ucwords(strtolower($addr->city), " \t\r\n\f\v'") }}{{ $addr->county ? ', ' . ucwords(strtolower($addr->county), " \t\r\n\f\v'") : '' }}</div>
          @endif
          @if($addr->postcode)
            <div class="address-line">{{ strtoupper($addr->postcode) }}</div>
          @endif
        @endif

        @if($invoice->customer->email)
          <div class="address-line" style="margin-top:4px; color:#97B545;">{{ $invoice->customer->email }}</div>
        @endif

        <div class="job-ref">Re: {{ $invoice->job->title }}</div>
      </td>
      <td class="invoice-info-cell">
        <table class="info-table" cellpadding="0" cellspacing="0">
          <tr>
            <td class="info-label">{{ $type === 'receipt' ? 'Receipt No.' : 'Invoice No.' }}</td>
            <td class="info-value">{{ $invoice->invoice_number }}</td>
          </tr>
          <tr>
            <td class="info-label">Date Issued</td>
            <td class="info-value">{{ $invoice->issued_date->format('d/m/Y') }}</td>
          </tr>
          @if($type === 'invoice')
            <tr>
              <td class="info-label">Due Date</td>
              <td class="info-value">{{ $invoice->due_date->format('d/m/Y') }}</td>
            </tr>
          @endif
          @if($type === 'receipt' && $invoice->paid_at)
            <tr>
              <td class="info-label">Paid On</td>
              <td class="info-value">{{ $invoice->paid_at->format('d/m/Y') }}</td>
            </tr>
          @endif
          <tr>
            <td class="info-label">Job Type</td>
            <td class="info-value">{{ ucfirst($invoice->job->type) }}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  {{-- ── Line Items ── --}}
  <table class="items-table" cellpadding="0" cellspacing="0">
    <thead>
      <tr>
        <th style="width:65%">Description</th>
        <th class="right" style="width:15%">Hours / Qty</th>
        <th class="right" style="width:20%">Amount</th>
      </tr>
    </thead>
    <tbody>
      @php
        $labourItems   = $invoice->lineItems->where('type', 'labour');
        $materialItems = $invoice->lineItems->where('type', 'material');
        $calloutItems  = $invoice->lineItems->where('type', 'callout');
      @endphp

      @if($labourItems->isNotEmpty())
        @php
          $labourByDate = [];
          $labourDateOrder = [];
          foreach ($labourItems as $item) {
            preg_match('/(\d{2}\/\d{2}\/\d{4})$/', trim($item->description), $m);
            $key = $m[1] ?? 'unknown';
            if (!isset($labourByDate[$key])) {
              $labourByDate[$key] = ['hours' => 0, 'amount' => 0];
              $labourDateOrder[] = $key;
            }
            $labourByDate[$key]['hours']  += $item->quantity;
            $labourByDate[$key]['amount'] += $item->amount;
          }
        @endphp
        <tr>
          <td colspan="3" style="padding: 4px 10px; font-size:7.5px; font-weight:bold; color:#0F3714; text-transform:uppercase; letter-spacing:1px; background:#eef6d6; border-top:1px solid #c8e08a;">
            Labour
          </td>
        </tr>
        @foreach($labourDateOrder as $visitNum => $key)
          @php
            try { $visitDate = \Carbon\Carbon::createFromFormat('d/m/Y', $key)->format('j M Y'); }
            catch (\Exception $e) { $visitDate = $key; }
            $row = $labourByDate[$key];
          @endphp
          <tr class="labour-row">
            <td>Visit {{ $visitNum + 1 }} — {{ $visitDate }}</td>
            <td class="right muted">{{ number_format($row['hours'], 2) }}h</td>
            <td class="right">€{{ number_format($row['amount'], 2) }}</td>
          </tr>
        @endforeach
      @endif

      @if($materialItems->isNotEmpty())
        <tr>
          <td colspan="3" style="padding: 4px 10px; font-size:7.5px; font-weight:bold; color:#92400e; text-transform:uppercase; letter-spacing:1px; background:#fffbeb; border-top:1px solid #fde68a;">
            Materials &amp; Supplies
          </td>
        </tr>
        @foreach($materialItems as $item)
          @php
            $qtyDisplay = fmod((float) $item->quantity, 1) == 0
              ? (int) $item->quantity
              : number_format($item->quantity, 2);
          @endphp
          <tr class="material-row">
            <td>{{ $item->description }}</td>
            <td class="right muted">{{ $qtyDisplay }}{{ $item->unit ? ' ' . $item->unit : '' }}</td>
            <td class="right">€{{ number_format($item->amount, 2) }}</td>
          </tr>
        @endforeach
      @endif

      @if($calloutItems->isNotEmpty())
        <tr>
          <td colspan="3" style="padding: 4px 10px; font-size:7.5px; font-weight:bold; color:#1e40af; text-transform:uppercase; letter-spacing:1px; background:#eff6ff; border-top:1px solid #bfdbfe;">
            Additional Charges
          </td>
        </tr>
        @foreach($calloutItems as $item)
          <tr style="background:#f0f7ff;">
            <td>{{ $item->description }}</td>
            <td class="right muted">—</td>
            <td class="right">€{{ number_format($item->amount, 2) }}</td>
          </tr>
        @endforeach
      @endif
    </tbody>
  </table>

  {{-- ── Totals ── --}}
  <table class="totals-wrapper" cellpadding="0" cellspacing="0" style="margin-top:0;">
    <tr>
      <td class="totals-spacer"></td>
      <td class="totals-block">
        <table class="totals-table" cellpadding="0" cellspacing="0">
          <tr>
            <td class="t-label">Subtotal (ex-VAT)</td>
            <td class="t-value">€{{ number_format($invoice->subtotal, 2) }}</td>
          </tr>

          @if($invoice->discount_pct > 0)
            <tr class="discount-row">
              <td class="t-label">Discount ({{ number_format($invoice->discount_pct, 0) }}%)</td>
              <td class="t-value">−€{{ number_format($invoice->discount_amount, 2) }}</td>
            </tr>
            <tr>
              <td class="t-label" style="color:#888; font-size:8.5px;">After discount</td>
              <td class="t-value" style="font-size:8.5px;">€{{ number_format($invoice->subtotal - $invoice->discount_amount, 2) }}</td>
            </tr>
          @endif

          <tr>
            <td class="t-label">VAT ({{ number_format($invoice->vat_rate, 1) }}%)</td>
            <td class="t-value">€{{ number_format($invoice->vat_amount, 2) }}</td>
          </tr>

          @if($invoice->loyalty_credit_applied && $invoice->loyalty_credit_amount)
          <tr style="background:#f3f8e8;">
            <td class="t-label" style="color:#15803d;">&#9733; Loyalty Reward</td>
            <td class="t-value" style="color:#15803d;">&minus;&euro;{{ number_format($invoice->loyalty_credit_amount, 2) }}</td>
          </tr>
          @endif

          <tr class="total-due-row">
            <td class="t-label">{{ $type === 'receipt' ? 'Total Charged' : 'Total Due' }}</td>
            <td class="t-value">€{{ number_format($invoice->total_due, 2) }}</td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  {{-- ── Loyalty Snapshot (maintenance jobs only) ── --}}
  @if($invoice->loyalty_hours_earned !== null && $invoice->loyalty_balance_after !== null)
  @php $threshold = $settings->loyalty_threshold_hours ?? 60; @endphp
  <div style="margin-top:14px; background:#f3f8e8; border:1.5px solid #c8e08a; border-radius:5px; padding:8px 12px;">
    <span style="font-size:7.5px; font-weight:bold; color:#0F3714; text-transform:uppercase; letter-spacing:1px;">&#9733; Maintenance Loyalty Programme</span>

    @if($invoice->loyalty_credit_applied)
      {{-- Credit was redeemed on this invoice --}}
      <div style="font-size:8.5px; color:#444; margin-top:3px; line-height:1.6;">
        <strong style="color:#15803d;">&#10003; Complimentary visit redeemed on this invoice.</strong><br>
        Points earned this job: <strong>{{ number_format($invoice->loyalty_hours_earned, 1) }}</strong> &mdash;
        balance remaining: <strong>{{ number_format($invoice->loyalty_balance_after, 1) }} / {{ $threshold }} points</strong> towards your next free visit.
      </div>
    @elseif($invoice->loyalty_balance_after >= $threshold)
      {{-- Hit threshold but not yet redeemed --}}
      @php $overflow = fmod($invoice->loyalty_balance_after, $threshold); @endphp
      <div style="font-size:8.5px; color:#444; margin-top:3px; line-height:1.6;">
        You earned <strong>{{ number_format($invoice->loyalty_hours_earned, 1) }} points</strong> on this job &mdash;
        <strong>you've earned a complimentary maintenance visit!</strong><br>
        <strong>{{ number_format($overflow, 1) }} points</strong> towards your next free visit &mdash; redeem at your discretion.
      </div>
    @else
      {{-- Still building points --}}
      <div style="font-size:8.5px; color:#444; margin-top:3px; line-height:1.6;">
        You earned <strong>{{ number_format($invoice->loyalty_hours_earned, 1) }} points</strong> on this job &mdash;
        current balance: <strong>{{ number_format($invoice->loyalty_balance_after, 1) }} / {{ $threshold }} points</strong> towards your next free visit.
      </div>
    @endif
  </div>
  @endif

  {{-- ── Payment Section ── --}}
  <div class="payment-section">
    <table class="payment-grid" cellpadding="0" cellspacing="0">
      <tr>
        <td class="payment-terms-cell">

          @if($type === 'receipt' && $invoice->amount_paid !== null)
            {{-- Receipt: show payment confirmation box --}}
            @php $variance = round($invoice->amount_paid - $invoice->total_due, 2); @endphp
            <div class="payment-box">
              <div class="payment-box-label">&#10003; Payment Received</div>
              <div class="payment-box-amount">€{{ number_format($invoice->amount_paid, 2) }}</div>
              <div class="payment-box-detail">
                Method: {{ $invoice->payment_method === 'bank_transfer' ? 'Bank Transfer' : 'Cash' }}<br>
                @if($invoice->paid_at)Date: {{ $invoice->paid_at->format('d/m/Y') }}@endif
              </div>
              @if($variance > 0.005)
                <div class="variance-over">Overpaid by €{{ number_format($variance, 2) }} — thank you!</div>
              @elseif($variance < -0.005)
                <div class="variance-under">Balance outstanding: €{{ number_format(abs($variance), 2) }}</div>
              @else
                <div class="variance-over">Paid in full</div>
              @endif
              @if($invoice->payment_notes)
                <div class="payment-box-detail" style="margin-top:4px; color:#6b7280; font-style:italic;">{{ $invoice->payment_notes }}</div>
              @endif
            </div>

          @else
            {{-- Invoice: bank details --}}
            <div class="section-label" style="margin-bottom:6px;">Payment Details</div>
            <div class="bank-details">
              <strong>Bank Transfer:</strong><br>
              Account Name: Lennon Landscaping<br>
              IBAN: {{ env('COMPANY_IBAN') }}<br>
              BIC: {{ env('COMPANY_BIC') }}
            </div>
            <div class="bank-details" style="margin-top:6px;">
              <strong>Cash</strong> payments also accepted.
            </div>
            <div class="bank-details" style="margin-top:8px; color:#888;">
              Payment due within 30 days of invoice date.<br>
              Please quote <strong>{{ $invoice->invoice_number }}</strong> on your transfer.
            </div>
          @endif

        </td>
        <td class="payment-notes-cell" style="vertical-align:bottom;">
          @if($invoice->notes)
            <div class="notes-box">
              <strong style="color:#0F3714; font-size:8px; display:block; margin-bottom:3px;">Note</strong>
              {{ $invoice->notes }}
            </div>
          @endif
        </td>
      </tr>
    </table>
  </div>

  {{-- ── Footer ── --}}
  <table class="footer" cellpadding="0" cellspacing="0">
    <tr>
      <td class="footer-left">
        <div class="footer-thanks">Thank you for your business!</div>
        <div class="footer-sub">Lennon Landscaping &mdash; Professional Landscaping &amp; Garden Services in Millstreet, Co. Cork</div>
      </td>
      <td class="footer-right">
        <div class="footer-website">lennonlandscaping.ie</div>
        <div class="footer-sub" style="margin-top:2px;">info@lennonlandscaping.ie</div>
      </td>
    </tr>
  </table>

</div>
</body>
</html>
