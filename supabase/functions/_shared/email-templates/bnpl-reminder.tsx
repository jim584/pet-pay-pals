/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Section,
} from 'npm:@react-email/components@0.0.22'

export type BnplStage = 'upcoming' | 'due' | 'missed' | 'default'

interface Props {
  stage: BnplStage
  recipientName?: string
  clinicName: string
  installmentSeq: number
  totalInstallments: number
  amount: string
  dueDate: string
  outstandingAmount: string
  payUrl: string
}

const COPY: Record<BnplStage, { preview: string; heading: string; intro: string; cta: string }> = {
  upcoming: {
    preview: 'Your upcoming Help A Pet payment',
    heading: 'Heads up — your next payment is coming',
    intro: "Your next installment for your pet's vet bill is due soon. You can pay now to stay ahead.",
    cta: 'Pay now',
  },
  due: {
    preview: 'Your Help A Pet payment is due today',
    heading: 'Your installment is due today',
    intro: "Today is the due date for your next installment. Tap below to pay and keep your plan in good standing.",
    cta: 'Pay today',
  },
  missed: {
    preview: 'A Help A Pet installment was missed',
    heading: 'A payment was missed',
    intro: 'We were unable to confirm payment for one of your installments. Please pay it as soon as possible to avoid default.',
    cta: 'Pay now',
  },
  default: {
    preview: 'Your Help A Pet payment plan is in default',
    heading: 'Your payment plan is in default',
    intro: 'Multiple installments were missed and your payment plan has been marked as defaulted. Please contact support or pay the outstanding balance.',
    cta: 'Pay outstanding balance',
  },
}

export const BnplReminderEmail = (p: Props) => {
  const c = COPY[p.stage]
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{c.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={brand}>🐾 Help A Pet</Text>
          <Heading style={h1}>{c.heading}</Heading>
          <Text style={text}>{p.recipientName ? `Hi ${p.recipientName},` : 'Hi there,'}</Text>
          <Text style={text}>{c.intro}</Text>
          <Section style={panel}>
            <Text style={panelRow}><strong>Clinic:</strong> {p.clinicName}</Text>
            <Text style={panelRow}><strong>Installment:</strong> {p.installmentSeq} of {p.totalInstallments}</Text>
            <Text style={panelRow}><strong>Amount due:</strong> ${p.amount}</Text>
            <Text style={panelRow}><strong>Due date:</strong> {p.dueDate}</Text>
            <Text style={panelRow}><strong>Outstanding balance:</strong> ${p.outstandingAmount}</Text>
          </Section>
          <Button style={button} href={p.payUrl}>{c.cta}</Button>
          <Text style={footer}>
            Manage your payment plans at any time from your Help A Pet dashboard.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export default BnplReminderEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const brand = {
  fontSize: '18px', fontWeight: 'bold' as const,
  fontFamily: "'Space Grotesk', Arial, sans-serif",
  color: 'hsl(225, 47%, 20%)', margin: '0 0 24px',
}
const h1 = {
  fontSize: '22px', fontWeight: 'bold' as const,
  fontFamily: "'Space Grotesk', Arial, sans-serif",
  color: 'hsl(220, 20%, 10%)', margin: '0 0 16px',
}
const text = { fontSize: '15px', color: 'hsl(220, 10%, 30%)', lineHeight: '1.6', margin: '0 0 16px' }
const panel = {
  backgroundColor: '#f7f7fb',
  border: '1px solid #e5e7eb',
  borderRadius: '12px',
  padding: '16px 20px',
  margin: '8px 0 24px',
}
const panelRow = { fontSize: '14px', color: 'hsl(220, 14%, 25%)', margin: '4px 0' }
const button = {
  backgroundColor: 'hsl(43, 64%, 55%)',
  color: '#1B2A4A',
  fontSize: '15px', fontWeight: '700' as const,
  borderRadius: '10px', padding: '14px 24px', textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#888', margin: '24px 0 0' }
