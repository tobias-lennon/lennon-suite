<?php

namespace App\Mail;

use App\Models\Payslip;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Attachment;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class PayslipMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(
        public Payslip $payslip,
        public string $pdfContent,
    ) {}

    public function envelope(): Envelope
    {
        $start = $this->payslip->payrollRun->period_start->format('d M');
        $end   = $this->payslip->payrollRun->period_end->format('d M Y');

        return new Envelope(
            subject: "Your payslip: {$start} – {$end}",
        );
    }

    public function content(): Content
    {
        return new Content(view: 'emails.payslip');
    }

    public function attachments(): array
    {
        $period   = $this->payslip->payrollRun->period_start->format('Y-m-d');
        $filename = "payslip-{$period}.pdf";

        return [
            Attachment::fromData(fn() => $this->pdfContent, $filename)
                ->withMime('application/pdf'),
        ];
    }
}
