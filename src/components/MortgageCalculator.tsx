"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useState, useEffect } from "react";
import {
  calculateMonthlyPayment,
  calculateTotalInterest,
  calculateRecastPayment,
  calculateBreakEvenMonths,
  calculateAmortizationSchedule,
  type MortgageParams,
} from "@/lib/mortgageCalculations";

const STORAGE_KEY = "mortgageCalculator";

const formSchema = z.object({
  currentBalance: z.coerce.number(),
  currentRate: z.coerce.number(),
  monthlyPayment: z.coerce.number(),
  remainingTerm: z.coerce.number().int(),
  propertyValue: z.coerce.number(),
  newRate: z.coerce.number(),
  lumpSum: z.coerce.number(),
});

type FormSchema = z.infer<typeof formSchema>;

const REFINANCE_CLOSING_COSTS_PERCENTAGE = 0.03; // 3% of loan amount

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Add type definition for schedule entry
type ScheduleEntry = {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  remainingBalance: number;
};

export function MortgageCalculator() {
  const [results, setResults] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentBalance: 0,
      currentRate: 0,
      monthlyPayment: 0,
      remainingTerm: 0,
      propertyValue: 0,
      newRate: 0,
      lumpSum: 0,
    },
  });

  // Load saved data on component mount
  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      form.reset(parsedData);
      calculateMortgageOptions(parsedData);
    }
    setIsLoading(false);
  }, []);

  // Save form data whenever it changes
  useEffect(() => {
    const subscription = form.watch((values) => {
      if (!isLoading) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(values));
      }
    });
    return () => subscription.unsubscribe();
  }, [form.watch, isLoading]);

  function calculateMortgageOptions(values: FormSchema) {
    // Calculate current mortgage details
    const currentMonthlyPayment = calculateMonthlyPayment({
      principal: values.currentBalance,
      annualRate: values.currentRate,
      termMonths: values.remainingTerm,
    });

    const currentTotalInterest = calculateTotalInterest({
      principal: values.currentBalance,
      annualRate: values.currentRate,
      termMonths: values.remainingTerm,
      monthlyPayment: currentMonthlyPayment,
    });

    // Calculate refinance option (applying lump sum to reduce principal)
    const refinanceClosingCosts =
      values.currentBalance * REFINANCE_CLOSING_COSTS_PERCENTAGE;
    const refinancePrincipal = values.currentBalance - values.lumpSum;
    const refinanceMonthlyPayment = calculateMonthlyPayment({
      principal: refinancePrincipal,
      annualRate: values.newRate,
      termMonths: values.remainingTerm,
    });

    const refinanceTotalInterest = calculateTotalInterest({
      principal: refinancePrincipal,
      annualRate: values.newRate,
      termMonths: values.remainingTerm,
      monthlyPayment: refinanceMonthlyPayment,
    });

    const breakEvenMonths = calculateBreakEvenMonths(
      refinanceClosingCosts,
      currentMonthlyPayment,
      refinanceMonthlyPayment
    );

    // Calculate recast option (applying lump sum to reduce principal)
    const recastMonthlyPayment = calculateRecastPayment({
      principal: values.currentBalance,
      annualRate: values.currentRate,
      termMonths: values.remainingTerm,
      extraPayment: values.lumpSum,
    });

    const recastTotalInterest = calculateTotalInterest({
      principal: values.currentBalance - values.lumpSum,
      annualRate: values.currentRate,
      termMonths: values.remainingTerm,
      monthlyPayment: recastMonthlyPayment,
    });

    // Calculate amortization schedules
    const currentSchedule = calculateAmortizationSchedule({
      principal: values.currentBalance,
      annualRate: values.currentRate,
      termMonths: values.remainingTerm,
      monthlyPayment: currentMonthlyPayment,
    });

    const refinanceSchedule = calculateAmortizationSchedule({
      principal: refinancePrincipal,
      annualRate: values.newRate,
      termMonths: values.remainingTerm,
      monthlyPayment: refinanceMonthlyPayment,
    });

    const recastSchedule = calculateAmortizationSchedule({
      principal: values.currentBalance - values.lumpSum,
      annualRate: values.currentRate,
      termMonths: values.remainingTerm,
      monthlyPayment: recastMonthlyPayment,
    });

    setResults({
      current: {
        monthlyPayment: currencyFormatter.format(currentMonthlyPayment),
        totalInterest: currencyFormatter.format(currentTotalInterest),
        schedule: currentSchedule,
      },
      refinance: {
        monthlyPayment: currencyFormatter.format(refinanceMonthlyPayment),
        totalInterest: currencyFormatter.format(refinanceTotalInterest),
        breakEven: breakEvenMonths,
        closingCosts: currencyFormatter.format(refinanceClosingCosts),
        schedule: refinanceSchedule,
      },
      recast: {
        monthlyPayment: currencyFormatter.format(recastMonthlyPayment),
        totalInterest: currencyFormatter.format(recastTotalInterest),
        schedule: recastSchedule,
      },
    });
  }

  if (isLoading) {
    return <div>Loading saved data...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Mortgage Calculator</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(calculateMortgageOptions)}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="currentBalance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Mortgage Balance ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="250000"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="currentRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Interest Rate (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.125"
                          placeholder="4.5"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="monthlyPayment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Monthly Payment ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="1500"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="remainingTerm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Remaining Term (months)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="300" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="propertyValue"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Property Value ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="300000"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="newRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Interest Rate (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.125"
                          placeholder="3.5"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lumpSum"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Available Lump Sum ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="50000"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Amount available to apply to principal (used for both
                        refinance and recast calculations)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex gap-4">
                <Button type="submit">Calculate Options</Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    localStorage.removeItem(STORAGE_KEY);
                    form.reset({
                      currentBalance: 0,
                      currentRate: 0,
                      monthlyPayment: 0,
                      remainingTerm: 0,
                      propertyValue: 0,
                      newRate: 0,
                      lumpSum: 0,
                    });
                    setResults(null);
                  }}
                >
                  Clear Saved Data
                </Button>
              </div>
            </form>
          </Form>

          {results && (
            <div className="mt-8 space-y-8">
              <div>
                <h3 className="text-lg font-semibold mb-4">Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Current Mortgage</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p>Monthly Payment: {results.current.monthlyPayment}</p>
                      <p>Total Interest: {results.current.totalInterest}</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Refinance Option</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p>Monthly Payment: {results.refinance.monthlyPayment}</p>
                      <p>Total Interest: {results.refinance.totalInterest}</p>
                      <p>Closing Costs: {results.refinance.closingCosts}</p>
                      <p>
                        Break-even Period: {results.refinance.breakEven} months
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Recast Option</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p>Monthly Payment: {results.recast.monthlyPayment}</p>
                      <p>Total Interest: {results.recast.totalInterest}</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Payment Schedule Comparison
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="p-2 text-left border" colSpan={4}>
                          Current Mortgage
                        </th>
                        <th className="p-2 text-left border" colSpan={4}>
                          Refinance Option
                        </th>
                        <th className="p-2 text-left border" colSpan={4}>
                          Recast Option
                        </th>
                      </tr>
                      <tr className="bg-gray-50">
                        <th className="p-2 text-left border">Month</th>
                        <th className="p-2 text-left border">Payment</th>
                        <th className="p-2 text-left border">Principal</th>
                        <th className="p-2 text-left border">Interest</th>
                        <th className="p-2 text-left border">Payment</th>
                        <th className="p-2 text-left border">Principal</th>
                        <th className="p-2 text-left border">Interest</th>
                        <th className="p-2 text-left border">Savings</th>
                        <th className="p-2 text-left border">Payment</th>
                        <th className="p-2 text-left border">Principal</th>
                        <th className="p-2 text-left border">Interest</th>
                        <th className="p-2 text-left border">Savings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {results.current.schedule
                        .slice(0, 24)
                        .map((current: ScheduleEntry, index: number) => {
                          const refinance = results.refinance.schedule[index];
                          const recast = results.recast.schedule[index];
                          const refinanceSavings =
                            current.payment - refinance.payment;
                          const recastSavings =
                            current.payment - recast.payment;

                          return (
                            <tr
                              key={index}
                              className={
                                index % 2 === 0 ? "bg-white" : "bg-gray-50"
                              }
                            >
                              <td className="p-2 border">{current.month}</td>
                              <td className="p-2 border">
                                {currencyFormatter.format(current.payment)}
                              </td>
                              <td className="p-2 border">
                                {currencyFormatter.format(current.principal)}
                              </td>
                              <td className="p-2 border">
                                {currencyFormatter.format(current.interest)}
                              </td>
                              <td className="p-2 border">
                                {currencyFormatter.format(refinance.payment)}
                              </td>
                              <td className="p-2 border">
                                {currencyFormatter.format(refinance.principal)}
                              </td>
                              <td className="p-2 border">
                                {currencyFormatter.format(refinance.interest)}
                              </td>
                              <td className="p-2 border">
                                <span
                                  className={
                                    refinanceSavings > 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }
                                >
                                  {currencyFormatter.format(
                                    Math.abs(refinanceSavings)
                                  )}
                                  {refinanceSavings > 0 ? " saved" : " more"}
                                </span>
                              </td>
                              <td className="p-2 border">
                                {currencyFormatter.format(recast.payment)}
                              </td>
                              <td className="p-2 border">
                                {currencyFormatter.format(recast.principal)}
                              </td>
                              <td className="p-2 border">
                                {currencyFormatter.format(recast.interest)}
                              </td>
                              <td className="p-2 border">
                                <span
                                  className={
                                    recastSavings > 0
                                      ? "text-green-600"
                                      : "text-red-600"
                                  }
                                >
                                  {currencyFormatter.format(
                                    Math.abs(recastSavings)
                                  )}
                                  {recastSavings > 0 ? " saved" : " more"}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                    <tfoot>
                      <tr className="bg-gray-100 font-semibold">
                        <td className="p-2 border" colSpan={2}>
                          First 2 Years Total:
                        </td>
                        <td className="p-2 border">
                          {currencyFormatter.format(
                            results.current.schedule
                              .slice(0, 24)
                              .reduce(
                                (sum: number, month: ScheduleEntry) =>
                                  sum + month.principal,
                                0
                              )
                          )}
                        </td>
                        <td className="p-2 border">
                          {currencyFormatter.format(
                            results.current.schedule
                              .slice(0, 24)
                              .reduce(
                                (sum: number, month: ScheduleEntry) =>
                                  sum + month.interest,
                                0
                              )
                          )}
                        </td>
                        <td className="p-2 border" colSpan={2}>
                          {currencyFormatter.format(
                            results.refinance.schedule
                              .slice(0, 24)
                              .reduce(
                                (sum: number, month: ScheduleEntry) =>
                                  sum + month.principal,
                                0
                              )
                          )}
                        </td>
                        <td className="p-2 border">
                          {currencyFormatter.format(
                            results.refinance.schedule
                              .slice(0, 24)
                              .reduce(
                                (sum: number, month: ScheduleEntry) =>
                                  sum + month.interest,
                                0
                              )
                          )}
                        </td>
                        <td className="p-2 border">
                          {currencyFormatter.format(
                            results.current.schedule
                              .slice(0, 24)
                              .reduce(
                                (sum: number, month: ScheduleEntry) =>
                                  sum + month.payment,
                                0
                              ) -
                              results.refinance.schedule
                                .slice(0, 24)
                                .reduce(
                                  (sum: number, month: ScheduleEntry) =>
                                    sum + month.payment,
                                  0
                                )
                          )}
                        </td>
                        <td className="p-2 border" colSpan={2}>
                          {currencyFormatter.format(
                            results.recast.schedule
                              .slice(0, 24)
                              .reduce(
                                (sum: number, month: ScheduleEntry) =>
                                  sum + month.principal,
                                0
                              )
                          )}
                        </td>
                        <td className="p-2 border">
                          {currencyFormatter.format(
                            results.recast.schedule
                              .slice(0, 24)
                              .reduce(
                                (sum: number, month: ScheduleEntry) =>
                                  sum + month.interest,
                                0
                              )
                          )}
                        </td>
                        <td className="p-2 border">
                          {currencyFormatter.format(
                            results.current.schedule
                              .slice(0, 24)
                              .reduce(
                                (sum: number, month: ScheduleEntry) =>
                                  sum + month.payment,
                                0
                              ) -
                              results.recast.schedule
                                .slice(0, 24)
                                .reduce(
                                  (sum: number, month: ScheduleEntry) =>
                                    sum + month.payment,
                                  0
                                )
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  * Showing first 24 months. Principal builds equity in your
                  home, while interest is the cost of borrowing.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
