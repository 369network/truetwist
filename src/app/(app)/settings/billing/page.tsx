"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  CreditCard,
  Sparkles,
  ArrowUpRight,
  Zap,
  Download,
  Plus,
  Trash2,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowDownRight,
  Receipt,
  Coins,
  X,
} from "lucide-react";

/* ──────── Mock Data ──────── */

const plans = [
  {
    name: "Starter",
    price: "$19",
    yearlyPrice: "$15",
    period: "/mo",
    features: ["3 platforms", "100 AI credits/mo", "Basic analytics", "1 team seat", "Email support"],
    current: false,
    popular: false,
  },
  {
    name: "Pro",
    price: "$49",
    yearlyPrice: "$39",
    period: "/mo",
    features: ["7 platforms", "500 AI credits/mo", "Advanced analytics", "3 team seats", "Priority support", "A/B testing"],
    current: true,
    popular: true,
  },
  {
    name: "Agency",
    price: "$149",
    yearlyPrice: "$119",
    period: "/mo",
    features: ["Unlimited platforms", "2000 AI credits/mo", "White-label", "Unlimited seats", "Dedicated support", "Custom AI models", "API access"],
    current: false,
    popular: false,
  },
];

const invoices = [
  { id: "INV-2026-004", date: "Apr 4, 2026", amount: "$49.00", status: "paid", plan: "Pro" },
  { id: "INV-2026-003", date: "Mar 4, 2026", amount: "$49.00", status: "paid", plan: "Pro" },
  { id: "INV-2026-002", date: "Feb 4, 2026", amount: "$49.00", status: "paid", plan: "Pro" },
  { id: "INV-2026-001", date: "Jan 4, 2026", amount: "$19.00", status: "paid", plan: "Starter" },
  { id: "INV-2025-012", date: "Dec 4, 2025", amount: "$19.00", status: "paid", plan: "Starter" },
];

const creditHistory = [
  { date: "Apr 5", action: "Text generation", credits: -3, balance: 347 },
  { date: "Apr 5", action: "Image generation", credits: -10, balance: 350 },
  { date: "Apr 4", action: "Video generation", credits: -25, balance: 360 },
  { date: "Apr 4", action: "Hashtag research", credits: -2, balance: 385 },
  { date: "Apr 3", action: "Text generation", credits: -3, balance: 387 },
  { date: "Apr 3", action: "Content suggestions", credits: -5, balance: 390 },
  { date: "Apr 2", action: "Image generation", credits: -10, balance: 395 },
  { date: "Apr 1", action: "Monthly reset", credits: 500, balance: 405 },
];

const paymentMethods = [
  { id: "pm_1", type: "visa", last4: "4242", expiry: "12/28", isDefault: true },
  { id: "pm_2", type: "mastercard", last4: "8888", expiry: "06/27", isDefault: false },
];

const creditTopUps = [
  { amount: 100, price: "$9" },
  { amount: 250, price: "$19" },
  { amount: 500, price: "$35" },
  { amount: 1000, price: "$59" },
];

/* ──────── Component ──────── */

export default function BillingSettingsPage() {
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "yearly">("monthly");
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [showAddPayment, setShowAddPayment] = useState(false);

  return (
    <div className="space-y-6">
      <Tabs defaultValue="subscription" className="w-full">
        <TabsList>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="credits">AI Credits</TabsTrigger>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="payment">Payment Methods</TabsTrigger>
        </TabsList>

        {/* ═══════ SUBSCRIPTION TAB ═══════ */}
        <TabsContent value="subscription">
          <div className="space-y-6 max-w-4xl">
            {/* Current Plan */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Current Plan</CardTitle>
                    <CardDescription>You&apos;re on the Pro plan</CardDescription>
                  </div>
                  <Badge variant="default" className="text-sm px-3 py-1">Pro</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Usage Meters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    { label: "AI Credits", used: 347, total: 500 },
                    { label: "Scheduled Posts", used: 24, total: 100 },
                    { label: "Team Seats", used: 2, total: 3 },
                    { label: "Video Generations", used: 8, total: 20 },
                  ].map((meter) => (
                    <div key={meter.label} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 dark:text-dark-muted">{meter.label}</span>
                        <span className="font-medium">{meter.used} / {meter.total}</span>
                      </div>
                      <Progress value={(meter.used / meter.total) * 100} />
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-dark-border">
                  <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-dark-muted">
                    <CreditCard className="w-4 h-4" />
                    <span>Next billing date: May 4, 2026 &middot; $49.00</span>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowCancelModal(true)}>
                      Cancel Plan
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Plan Comparison */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold">Change Plan</h2>
                <div className="flex items-center gap-2 bg-gray-100 dark:bg-dark-surface-2 rounded-lg p-1">
                  <button
                    onClick={() => setBillingPeriod("monthly")}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                      billingPeriod === "monthly"
                        ? "bg-white dark:bg-dark-surface shadow-sm text-gray-900 dark:text-dark-text"
                        : "text-gray-500 dark:text-dark-muted"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingPeriod("yearly")}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                      billingPeriod === "yearly"
                        ? "bg-white dark:bg-dark-surface shadow-sm text-gray-900 dark:text-dark-text"
                        : "text-gray-500 dark:text-dark-muted"
                    }`}
                  >
                    Yearly
                    <Badge variant="success" className="text-[10px] px-1.5 py-0">Save 20%</Badge>
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map((plan) => (
                  <Card
                    key={plan.name}
                    className={`relative ${plan.current ? "border-brand-500 ring-1 ring-brand-500" : ""} ${
                      plan.popular ? "md:-translate-y-1" : ""
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge variant="default" className="text-xs shadow-sm">
                          <Sparkles className="w-3 h-3 mr-1" />
                          Most Popular
                        </Badge>
                      </div>
                    )}
                    <CardContent className="p-5 pt-6">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">{plan.name}</h3>
                        {plan.current && <Badge variant="default">Current</Badge>}
                      </div>
                      <div className="mb-4">
                        <span className="text-3xl font-bold">
                          {billingPeriod === "yearly" ? plan.yearlyPrice : plan.price}
                        </span>
                        <span className="text-gray-400 text-sm">{plan.period}</span>
                        {billingPeriod === "yearly" && (
                          <p className="text-xs text-gray-400 mt-1">
                            Billed annually ({plan.yearlyPrice.replace("$", "$")}
                            {parseInt(plan.yearlyPrice.replace("$", "")) * 12}/yr)
                          </p>
                        )}
                      </div>
                      <ul className="space-y-2 mb-5">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-center gap-2 text-sm text-gray-600 dark:text-dark-muted">
                            <Zap className="w-3 h-3 text-brand-500 flex-shrink-0" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      {plan.current ? (
                        <Button variant="outline" className="w-full" disabled>
                          Current Plan
                        </Button>
                      ) : (
                        <Button
                          variant={plan.name === "Agency" ? "default" : "secondary"}
                          className="w-full"
                        >
                          {plan.name === "Starter" ? (
                            <>
                              <ArrowDownRight className="w-4 h-4 mr-1" />
                              Downgrade
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-4 h-4 mr-1" />
                              Upgrade
                            </>
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Cancel Modal */}
            {showCancelModal && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <Card className="w-full max-w-md">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-red-500">Cancel Subscription</CardTitle>
                      <button
                        onClick={() => setShowCancelModal(false)}
                        className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-dark-surface-2"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="p-3 rounded-md bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-900/30">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <div className="text-sm">
                          <p className="font-medium text-yellow-700 dark:text-yellow-400">You&apos;ll lose access to:</p>
                          <ul className="mt-1 space-y-1 text-yellow-600 dark:text-yellow-500">
                            <li>&bull; Advanced analytics &amp; A/B testing</li>
                            <li>&bull; 500 AI credits (347 remaining)</li>
                            <li>&bull; Team collaboration (2 members)</li>
                            <li>&bull; Priority support</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-dark-muted">
                      Your subscription will remain active until May 4, 2026. After that, you&apos;ll be moved to the free tier.
                    </p>
                    <div className="flex gap-2 justify-end">
                      <Button variant="outline" onClick={() => setShowCancelModal(false)}>
                        Keep Plan
                      </Button>
                      <Button variant="destructive" onClick={() => setShowCancelModal(false)}>
                        Cancel Subscription
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </TabsContent>

        {/* ═══════ AI CREDITS TAB ═══════ */}
        <TabsContent value="credits">
          <div className="space-y-6 max-w-3xl">
            {/* Credit Balance */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-brand-50 dark:bg-brand-900/20 flex items-center justify-center">
                      <Coins className="w-5 h-5 text-brand-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-dark-muted">Current Balance</p>
                      <p className="text-2xl font-bold">347</p>
                    </div>
                  </div>
                  <Progress value={69.4} className="mt-2" />
                  <p className="text-xs text-gray-400 mt-1">347 of 500 credits remaining</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-coral-50 dark:bg-coral-900/20 flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-coral-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-dark-muted">Used This Month</p>
                      <p className="text-2xl font-bold">153</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-4">Avg. 38/week</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-green-500" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-dark-muted">Resets In</p>
                      <p className="text-2xl font-bold">29d</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mt-4">May 4, 2026</p>
                </CardContent>
              </Card>
            </div>

            {/* Top Up */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Top Up Credits</CardTitle>
                    <CardDescription>Need more credits before your reset? Purchase additional credits.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {creditTopUps.map((topUp) => (
                    <button
                      key={topUp.amount}
                      className="p-4 rounded-lg border border-gray-200 dark:border-dark-border hover:border-brand-500 hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors text-center group"
                    >
                      <p className="text-2xl font-bold text-gray-900 dark:text-dark-text group-hover:text-brand-600">
                        {topUp.amount}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-dark-muted">credits</p>
                      <p className="text-sm font-semibold text-brand-600 mt-2">{topUp.price}</p>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Usage History */}
            <Card>
              <CardHeader>
                <CardTitle>Usage History</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-gray-100 dark:divide-dark-border">
                  {creditHistory.map((entry, i) => (
                    <div key={i} className="flex items-center justify-between py-3 first:pt-0 last:pb-0">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          entry.credits > 0
                            ? "bg-green-50 dark:bg-green-900/20"
                            : "bg-gray-50 dark:bg-dark-surface-2"
                        }`}>
                          {entry.credits > 0 ? (
                            <Plus className="w-4 h-4 text-green-500" />
                          ) : (
                            <Sparkles className="w-4 h-4 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{entry.action}</p>
                          <p className="text-xs text-gray-400">{entry.date}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-medium ${
                          entry.credits > 0 ? "text-green-500" : "text-gray-600 dark:text-dark-muted"
                        }`}>
                          {entry.credits > 0 ? "+" : ""}{entry.credits}
                        </p>
                        <p className="text-xs text-gray-400">bal: {entry.balance}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════ INVOICES TAB ═══════ */}
        <TabsContent value="invoices">
          <div className="space-y-4 max-w-3xl">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Invoice History</CardTitle>
                  <Button variant="outline" size="sm">
                    <Download className="w-4 h-4 mr-1" />
                    Export All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-dark-border">
                        <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-dark-muted">Invoice</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-dark-muted">Date</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-dark-muted">Plan</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-dark-muted">Amount</th>
                        <th className="text-left py-3 px-2 font-medium text-gray-500 dark:text-dark-muted">Status</th>
                        <th className="text-right py-3 px-2 font-medium text-gray-500 dark:text-dark-muted"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-dark-border">
                      {invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-dark-surface-2 transition-colors">
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-2">
                              <Receipt className="w-4 h-4 text-gray-400" />
                              <span className="font-medium">{inv.id}</span>
                            </div>
                          </td>
                          <td className="py-3 px-2 text-gray-500 dark:text-dark-muted">{inv.date}</td>
                          <td className="py-3 px-2">
                            <Badge variant="secondary">{inv.plan}</Badge>
                          </td>
                          <td className="py-3 px-2 font-medium">{inv.amount}</td>
                          <td className="py-3 px-2">
                            <Badge variant="success">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {inv.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-2 text-right">
                            <Button variant="ghost" size="sm">
                              <Download className="w-3 h-3 mr-1" />
                              PDF
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══════ PAYMENT METHODS TAB ═══════ */}
        <TabsContent value="payment">
          <div className="space-y-6 max-w-2xl">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Payment Methods</CardTitle>
                    <CardDescription>Manage your payment methods for billing</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowAddPayment(true)}>
                    <Plus className="w-4 h-4 mr-1" />
                    Add Card
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {paymentMethods.map((pm) => (
                    <div
                      key={pm.id}
                      className={`flex items-center justify-between p-4 rounded-lg border transition-colors ${
                        pm.isDefault
                          ? "border-brand-500 bg-brand-50/50 dark:bg-brand-900/10 dark:border-brand-500/50"
                          : "border-gray-200 dark:border-dark-border"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-8 rounded bg-gray-100 dark:bg-dark-surface-2 flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-gray-500" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium capitalize">{pm.type} &bull;&bull;&bull;&bull; {pm.last4}</p>
                            {pm.isDefault && <Badge variant="default" className="text-[10px]">Default</Badge>}
                          </div>
                          <p className="text-xs text-gray-400 dark:text-dark-muted">Expires {pm.expiry}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!pm.isDefault && (
                          <Button variant="ghost" size="sm" className="text-xs">
                            Set Default
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-50">
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Add Payment Modal */}
            {showAddPayment && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                <Card className="w-full max-w-md">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Add Payment Method</CardTitle>
                      <button
                        onClick={() => setShowAddPayment(false)}
                        className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-dark-surface-2"
                      >
                        <X className="w-4 h-4 text-gray-400" />
                      </button>
                    </div>
                    <CardDescription>Card details are securely processed by Stripe</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-1.5 block">Card Number</label>
                      <input
                        type="text"
                        placeholder="1234 5678 9012 3456"
                        className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">Expiry</label>
                        <input
                          type="text"
                          placeholder="MM/YY"
                          className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-1.5 block">CVC</label>
                        <input
                          type="text"
                          placeholder="123"
                          className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2.5 rounded-md bg-gray-50 dark:bg-dark-surface-2 text-xs text-gray-500 dark:text-dark-muted">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                      Secured with 256-bit SSL encryption via Stripe
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <Button variant="outline" onClick={() => setShowAddPayment(false)}>Cancel</Button>
                      <Button onClick={() => setShowAddPayment(false)}>Add Card</Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Billing Address */}
            <Card>
              <CardHeader>
                <CardTitle>Billing Address</CardTitle>
                <CardDescription>Used for invoices and tax calculation</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Full Name</label>
                    <input
                      type="text"
                      defaultValue="Alex Johnson"
                      className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Company</label>
                    <input
                      type="text"
                      defaultValue="TrueTwist Agency"
                      className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Address</label>
                  <input
                    type="text"
                    defaultValue="123 Marketing Blvd"
                    className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">City</label>
                    <input
                      type="text"
                      defaultValue="San Francisco"
                      className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">State</label>
                    <input
                      type="text"
                      defaultValue="CA"
                      className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">ZIP</label>
                    <input
                      type="text"
                      defaultValue="94102"
                      className="w-full h-10 px-3 rounded-md border border-gray-200 dark:border-dark-border bg-white dark:bg-dark-surface-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Button>Save Address</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
