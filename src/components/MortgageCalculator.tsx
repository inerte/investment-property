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
import { useState } from "react";
import {
  calculateMonthlyPayment,
  calculateTotalInterest,
  calculateRecastPayment,
  calculateBreakEvenMonths,
  type MortgageParams,
} from "@/lib/mortgageCalculations";

const formSchema = z.object({
  currentBalance: z.coerce.number(),
  currentRate: z.coerce.number(),
  monthlyPayment: z.coerce.number(),
  remainingTerm: z.coerce.number().int(),
  propertyValue: z.coerce.number(),
  newRate: z.coerce.number(),
  recastAmount: z.coerce.number(),
});

type FormSchema = z.infer<typeof formSchema>;

const REFINANCE_CLOSING_COSTS_PERCENTAGE = 0.03; // 3% of loan amount

export function MortgageCalculator() {
  const [results, setResults] = useState<any>(null);

  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      currentBalance: 0,
      currentRate: 0,
      monthlyPayment: 0,
      remainingTerm: 0,
      propertyValue: 0,
      newRate: 0,
      recastAmount: 0,
    },
  });

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

    // Calculate refinance option
    const refinanceClosingCosts =
      values.currentBalance * REFINANCE_CLOSING_COSTS_PERCENTAGE;
    const refinanceMonthlyPayment = calculateMonthlyPayment({
      principal: values.currentBalance,
      annualRate: values.newRate,
      termMonths: values.remainingTerm,
    });

    const refinanceTotalInterest = calculateTotalInterest({
      principal: values.currentBalance,
      annualRate: values.newRate,
      termMonths: values.remainingTerm,
      monthlyPayment: refinanceMonthlyPayment,
    });

    const breakEvenMonths = calculateBreakEvenMonths(
      refinanceClosingCosts,
      currentMonthlyPayment,
      refinanceMonthlyPayment
    );

    // Calculate recast option
    const recastMonthlyPayment = calculateRecastPayment({
      principal: values.currentBalance,
      annualRate: values.currentRate,
      termMonths: values.remainingTerm,
      extraPayment: values.recastAmount,
    });

    const recastTotalInterest = calculateTotalInterest({
      principal: values.currentBalance - values.recastAmount,
      annualRate: values.currentRate,
      termMonths: values.remainingTerm,
      monthlyPayment: recastMonthlyPayment,
    });

    setResults({
      current: {
        monthlyPayment: currentMonthlyPayment.toFixed(2),
        totalInterest: currentTotalInterest.toFixed(2),
      },
      refinance: {
        monthlyPayment: refinanceMonthlyPayment.toFixed(2),
        totalInterest: refinanceTotalInterest.toFixed(2),
        breakEven: breakEvenMonths,
        closingCosts: refinanceClosingCosts.toFixed(2),
      },
      recast: {
        monthlyPayment: recastMonthlyPayment.toFixed(2),
        totalInterest: recastTotalInterest.toFixed(2),
      },
    });
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
                  name="recastAmount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recast Amount ($)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="50000"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <Button type="submit">Calculate Options</Button>
            </form>
          </Form>

          {results && (
            <div className="mt-8 space-y-4">
              <h3 className="text-lg font-semibold">Results</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Current Mortgage</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>Monthly Payment: ${results.current.monthlyPayment}</p>
                    <p>Total Interest: ${results.current.totalInterest}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle>Refinance Option</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p>Monthly Payment: ${results.refinance.monthlyPayment}</p>
                    <p>Total Interest: ${results.refinance.totalInterest}</p>
                    <p>Closing Costs: ${results.refinance.closingCosts}</p>
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
                    <p>Monthly Payment: ${results.recast.monthlyPayment}</p>
                    <p>Total Interest: ${results.recast.totalInterest}</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
