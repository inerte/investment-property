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
import { v4 as uuidv4 } from "uuid";
import { ScenarioTabs, type Scenario } from "./ScenarioTabs";
import {
  calculateMonthlyPayment,
  calculateTotalInterest,
  calculateRecastPayment,
  calculateBreakEvenMonths,
  calculateAmortizationSchedule,
} from "@/lib/mortgageCalculations";

const STORAGE_KEY = "mortgageCalculator";

const defaultRefinanceClosingCosts = {
  titleInsurance: 0,
  appraisalFee: 0,
  originationFee: 0,
  recordingFees: 0,
  otherFees: 0,
};

const formSchema = z.object({
  currentBalance: z.coerce
    .number()
    .min(0, "Balance must be 0 or greater")
    .default(0),
  currentRate: z.coerce
    .number()
    .min(0, "Rate must be 0 or greater")
    .max(100, "Rate must be less than 100")
    .default(0),
  monthlyPayment: z.coerce
    .number()
    .min(0, "Payment must be 0 or greater")
    .default(0),
  remainingTerm: z.coerce
    .number()
    .int("Term must be a whole number")
    .min(1, "Term must be at least 1 month")
    .max(600, "Term must be less than 600 months")
    .default(0),
  propertyValue: z.coerce
    .number()
    .min(0, "Value must be 0 or greater")
    .default(0),
  newRate: z.coerce
    .number()
    .min(0, "Rate must be 0 or greater")
    .max(100, "Rate must be less than 100")
    .default(0),
  lumpSum: z.coerce.number().min(0, "Lump sum must be 0 or greater").default(0),
  plannedStayYears: z.coerce
    .number()
    .min(0, "Years must be 0 or greater")
    .max(100, "Years must be less than 100")
    .default(30),
  refinanceClosingCosts: z
    .object({
      titleInsurance: z.coerce.number().min(0).default(0),
      appraisalFee: z.coerce.number().min(0).default(0),
      originationFee: z.coerce.number().min(0).default(0),
      recordingFees: z.coerce.number().min(0).default(0),
      otherFees: z.coerce.number().min(0).default(0),
    })
    .default(defaultRefinanceClosingCosts),
  recastFee: z.coerce.number().min(0).default(250),
  alternativeInvestmentReturn: z.coerce
    .number()
    .min(0, "Return must be 0 or greater")
    .max(100, "Return must be less than 100")
    .default(7),
});

export type FormSchema = z.infer<typeof formSchema>;

const REFINANCE_CLOSING_COSTS_PERCENTAGE = 0.03; // 3% of loan amount

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("en-US", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

// Add type definition for schedule entry
type ScheduleEntry = {
  month: number;
  payment: number;
  principal: number;
  interest: number;
  remainingBalance: number;
};

type ResultsType = {
  current: {
    monthlyPayment: string;
    totalInterest: string;
    schedule: ScheduleEntry[];
  };
  refinance: {
    monthlyPayment: string;
    totalInterest: string;
    breakEven: number;
    closingCosts: string;
    schedule: ScheduleEntry[];
  };
  recast: {
    monthlyPayment: string;
    totalInterest: string;
    schedule: ScheduleEntry[];
  };
} | null;

function calculatePaymentBreakdown(
  payment: number,
  principal: number,
  interest: number
) {
  const principalPercentage = principal / payment;
  const interestPercentage = interest / payment;
  return {
    principalPercentage: percentFormatter.format(principalPercentage),
    interestPercentage: percentFormatter.format(interestPercentage),
  };
}

export function MortgageCalculator() {
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<string>("");
  const [results, setResults] = useState<ResultsType>(null);
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
      plannedStayYears: 30,
      refinanceClosingCosts: defaultRefinanceClosingCosts,
      recastFee: 250,
      alternativeInvestmentReturn: 7,
    },
    mode: "onChange",
  });

  // Load saved scenarios on component mount
  useEffect(() => {
    const savedData = localStorage.getItem(STORAGE_KEY);
    if (savedData) {
      const parsed = JSON.parse(savedData);
      if (Array.isArray(parsed)) {
        setScenarios(parsed);
        if (parsed.length > 0) {
          setActiveScenarioId(parsed[0].id);
          form.reset(parsed[0].data);
          calculateMortgageOptions(parsed[0].data);
        }
      } else {
        // Handle legacy data format
        const initialScenario = {
          id: uuidv4(),
          name: "Scenario 1",
          data: parsed,
        };
        setScenarios([initialScenario]);
        setActiveScenarioId(initialScenario.id);
        form.reset(parsed);
        calculateMortgageOptions(parsed);
      }
    } else {
      const initialScenario = {
        id: uuidv4(),
        name: "Scenario 1",
        data: form.getValues(),
      };
      setScenarios([initialScenario]);
      setActiveScenarioId(initialScenario.id);
    }
    setIsLoading(false);
  }, [form]);

  // Save scenarios whenever they change
  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios));
    }
  }, [scenarios, isLoading]);

  const handleScenarioAdd = (cloneFrom?: string) => {
    const baseData = cloneFrom
      ? scenarios.find((s) => s.id === cloneFrom)?.data || form.getValues()
      : {
          currentBalance: 0,
          currentRate: 0,
          monthlyPayment: 0,
          remainingTerm: 0,
          propertyValue: 0,
          newRate: 0,
          lumpSum: 0,
          plannedStayYears: 30,
          refinanceClosingCosts: defaultRefinanceClosingCosts,
          recastFee: 250,
          alternativeInvestmentReturn: 7,
        };

    const newScenario: Scenario = {
      id: uuidv4(),
      name: `Scenario ${scenarios.length + 1}`,
      data: baseData,
    };

    // Save current scenario before switching
    const updatedScenarios = scenarios.map((s) =>
      s.id === activeScenarioId ? { ...s, data: form.getValues() } : s
    );

    setScenarios([...updatedScenarios, newScenario]);
    setActiveScenarioId(newScenario.id);
    form.reset(newScenario.data);
  };

  const handleScenarioDelete = (id: string) => {
    const updatedScenarios = scenarios.filter((s) => s.id !== id);
    setScenarios(updatedScenarios);

    if (id === activeScenarioId) {
      const newActiveScenario = updatedScenarios[0];
      setActiveScenarioId(newActiveScenario.id);
      form.reset(newActiveScenario.data);
      calculateMortgageOptions(newActiveScenario.data);
    }
  };

  const handleScenarioChange = (id: string) => {
    const scenario = scenarios.find((s) => s.id === id);
    if (scenario) {
      // Save current form data to current scenario
      const updatedScenarios = scenarios.map((s) =>
        s.id === activeScenarioId ? { ...s, data: form.getValues() } : s
      );
      setScenarios(updatedScenarios);

      // Switch to new scenario
      setActiveScenarioId(id);
      form.reset(scenario.data);
      calculateMortgageOptions(scenario.data);
    }
  };

  const handleScenarioRename = (id: string, newName: string) => {
    setScenarios(
      scenarios.map((s) => (s.id === id ? { ...s, name: newName } : s))
    );
  };

  function calculateMortgageOptions(values: FormSchema) {
    // Add validation to prevent calculation with invalid values
    if (
      !values.currentBalance ||
      !values.currentRate ||
      !values.remainingTerm
    ) {
      setResults(null);
      return;
    }

    // Calculate current mortgage details
    const currentMonthlyPayment = calculateMonthlyPayment({
      principal: values.currentBalance,
      annualRate: values.currentRate,
      termMonths: values.remainingTerm,
    });

    // Update the form with the calculated monthly payment if it's not set
    if (!values.monthlyPayment) {
      form.setValue("monthlyPayment", currentMonthlyPayment);
      values.monthlyPayment = currentMonthlyPayment;
    }

    const currentTotalInterest = calculateTotalInterest({
      principal: values.currentBalance,
      annualRate: values.currentRate,
      termMonths: values.remainingTerm,
      monthlyPayment: currentMonthlyPayment,
    });

    // Calculate total closing costs from individual components
    const totalClosingCosts =
      (values.refinanceClosingCosts?.titleInsurance || 0) +
      (values.refinanceClosingCosts?.appraisalFee || 0) +
      (values.refinanceClosingCosts?.originationFee || 0) +
      (values.refinanceClosingCosts?.recordingFees || 0) +
      (values.refinanceClosingCosts?.otherFees || 0);

    // Calculate refinance option (applying lump sum to reduce principal)
    const refinanceClosingCosts =
      totalClosingCosts ||
      values.currentBalance * REFINANCE_CLOSING_COSTS_PERCENTAGE;
    const refinancePrincipal = values.currentBalance - (values.lumpSum || 0);
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
          <ScenarioTabs
            scenarios={scenarios}
            activeScenario={activeScenarioId}
            onScenarioChange={handleScenarioChange}
            onScenarioAdd={handleScenarioAdd}
            onScenarioRename={handleScenarioRename}
            onScenarioDelete={handleScenarioDelete}
          />
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((values) => {
                // Save form data to current scenario
                const updatedScenarios = scenarios.map((s) =>
                  s.id === activeScenarioId ? { ...s, data: values } : s
                );
                setScenarios(updatedScenarios);
                calculateMortgageOptions(values);
              })}
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
                          min="0"
                          placeholder="50000"
                          {...field}
                          value={field.value === 0 ? "" : field.value}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value === "" ? 0 : Number(value));
                          }}
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
                <FormField
                  control={form.control}
                  name="plannedStayYears"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Planned Stay Years</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="1"
                          placeholder="30"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="refinanceClosingCosts.titleInsurance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Title Insurance</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="refinanceClosingCosts.appraisalFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Appraisal Fee</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="refinanceClosingCosts.originationFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Origination Fee</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="refinanceClosingCosts.recordingFees"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recording Fees</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="refinanceClosingCosts.otherFees"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Other Fees</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="recastFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Recast Fee</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="250"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="alternativeInvestmentReturn"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alternative Investment Return (%)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.125"
                          placeholder="7"
                          {...field}
                        />
                      </FormControl>
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
                      plannedStayYears: 30,
                      refinanceClosingCosts: defaultRefinanceClosingCosts,
                      recastFee: 250,
                      alternativeInvestmentReturn: 7,
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
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-gray-600">
                          Payment Breakdown:
                        </p>
                        {(() => {
                          const firstMonth = results.current.schedule[0];
                          const { principalPercentage, interestPercentage } =
                            calculatePaymentBreakdown(
                              firstMonth.payment,
                              firstMonth.principal,
                              firstMonth.interest
                            );
                          return (
                            <>
                              <p className="text-sm">
                                Principal: {principalPercentage}
                              </p>
                              <p className="text-sm">
                                Interest: {interestPercentage}
                              </p>
                            </>
                          );
                        })()}
                      </div>
                      <p className="mt-4">
                        Total Interest: {results.current.totalInterest}
                      </p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Refinance Option</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p>Monthly Payment: {results.refinance.monthlyPayment}</p>
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-gray-600">
                          Payment Breakdown:
                        </p>
                        {(() => {
                          const firstMonth = results.refinance.schedule[0];
                          const { principalPercentage, interestPercentage } =
                            calculatePaymentBreakdown(
                              firstMonth.payment,
                              firstMonth.principal,
                              firstMonth.interest
                            );
                          return (
                            <>
                              <p className="text-sm">
                                Principal: {principalPercentage}
                              </p>
                              <p className="text-sm">
                                Interest: {interestPercentage}
                              </p>
                            </>
                          );
                        })()}
                      </div>
                      <p className="mt-4">
                        Total Interest: {results.refinance.totalInterest}
                      </p>
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
                      <div className="mt-2 space-y-1">
                        <p className="text-sm text-gray-600">
                          Payment Breakdown:
                        </p>
                        {(() => {
                          const firstMonth = results.recast.schedule[0];
                          const { principalPercentage, interestPercentage } =
                            calculatePaymentBreakdown(
                              firstMonth.payment,
                              firstMonth.principal,
                              firstMonth.interest
                            );
                          return (
                            <>
                              <p className="text-sm">
                                Principal: {principalPercentage}
                              </p>
                              <p className="text-sm">
                                Interest: {interestPercentage}
                              </p>
                            </>
                          );
                        })()}
                      </div>
                      <p className="mt-4">
                        Total Interest: {results.recast.totalInterest}
                      </p>
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
                        <th className="p-2 text-left border" colSpan={5}>
                          Current Mortgage
                        </th>
                        <th className="p-2 text-left border" colSpan={5}>
                          Refinance Option
                        </th>
                        <th className="p-2 text-left border" colSpan={5}>
                          Recast Option
                        </th>
                      </tr>
                      <tr className="bg-gray-50">
                        <th className="p-2 text-left border">Month</th>
                        <th className="p-2 text-left border">Payment</th>
                        <th className="p-2 text-left border">Principal</th>
                        <th className="p-2 text-left border">Interest</th>
                        <th className="p-2 text-left border">Ratio (P/I)</th>
                        <th className="p-2 text-left border">Payment</th>
                        <th className="p-2 text-left border">Principal</th>
                        <th className="p-2 text-left border">Interest</th>
                        <th className="p-2 text-left border">Ratio (P/I)</th>
                        <th className="p-2 text-left border">Savings</th>
                        <th className="p-2 text-left border">Payment</th>
                        <th className="p-2 text-left border">Principal</th>
                        <th className="p-2 text-left border">Interest</th>
                        <th className="p-2 text-left border">Ratio (P/I)</th>
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

                          const currentRatio = calculatePaymentBreakdown(
                            current.payment,
                            current.principal,
                            current.interest
                          );
                          const refinanceRatio = calculatePaymentBreakdown(
                            refinance.payment,
                            refinance.principal,
                            refinance.interest
                          );
                          const recastRatio = calculatePaymentBreakdown(
                            recast.payment,
                            recast.principal,
                            recast.interest
                          );

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
                              <td className="p-2 border text-sm">
                                {currentRatio.principalPercentage}/
                                {currentRatio.interestPercentage}
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
                              <td className="p-2 border text-sm">
                                {refinanceRatio.principalPercentage}/
                                {refinanceRatio.interestPercentage}
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
                              <td className="p-2 border text-sm">
                                {recastRatio.principalPercentage}/
                                {recastRatio.interestPercentage}
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
                  home, while interest is the cost of borrowing. The Ratio (P/I)
                  shows how your payment is split between Principal and
                  Interest.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Decision Analysis
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Break-even Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p>
                        Based on your planned stay of{" "}
                        {form.getValues().plannedStayYears} years:
                      </p>
                      {(() => {
                        const monthsPlanned =
                          form.getValues().plannedStayYears * 12;
                        const refinanceBreakEven = results.refinance.breakEven;
                        const isWorthRefinancing =
                          monthsPlanned > refinanceBreakEven;

                        // Calculate total closing costs
                        const closingCosts = Object.values(
                          form.getValues().refinanceClosingCosts || {}
                        ).reduce((sum, fee) => sum + (fee || 0), 0);

                        // Calculate monthly savings
                        const monthlySavings =
                          results.current.schedule[0].payment -
                          results.refinance.schedule[0].payment;

                        // Calculate total savings over planned stay
                        const totalSavings =
                          monthlySavings * monthsPlanned - closingCosts;

                        return (
                          <div className="mt-4 space-y-2">
                            <p
                              className={
                                isWorthRefinancing
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              {isWorthRefinancing
                                ? `Refinancing could be worthwhile - you'll break even in ${refinanceBreakEven} months and stay ${
                                    monthsPlanned - refinanceBreakEven
                                  } months after.`
                                : `Refinancing might not be worth it - you'll move ${
                                    refinanceBreakEven - monthsPlanned
                                  } months before breaking even.`}
                            </p>
                            <p className="text-sm text-gray-600">
                              Monthly payment savings:{" "}
                              {currencyFormatter.format(monthlySavings)}
                            </p>
                            <p className="text-sm text-gray-600">
                              Total closing costs:{" "}
                              {currencyFormatter.format(closingCosts)}
                            </p>
                            <p className="text-sm text-gray-600">
                              Total savings after {monthsPlanned} months:{" "}
                              {currencyFormatter.format(totalSavings)}
                            </p>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader>
                      <CardTitle>Opportunity Cost Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const lumpSum = form.getValues().lumpSum || 0;
                        const annualReturn =
                          (form.getValues().alternativeInvestmentReturn || 0) /
                          100;
                        const monthsPlanned =
                          form.getValues().plannedStayYears * 12;

                        const investmentValue =
                          lumpSum *
                          Math.pow(
                            1 + annualReturn,
                            form.getValues().plannedStayYears
                          );
                        const recastSavings =
                          (results.current.schedule[0].payment -
                            results.recast.schedule[0].payment) *
                            monthsPlanned -
                          (form.getValues().recastFee || 0);

                        const isInvestingBetter =
                          investmentValue > recastSavings + lumpSum;

                        return (
                          <div className="space-y-2">
                            <p>
                              If you invest the lump sum instead (
                              {percentFormatter.format(annualReturn)} annual
                              return):
                            </p>
                            <p className="font-medium">
                              Investment value after{" "}
                              {form.getValues().plannedStayYears} years:{" "}
                              {currencyFormatter.format(investmentValue)}
                            </p>
                            <p className="font-medium">
                              Recast savings after{" "}
                              {form.getValues().plannedStayYears} years:{" "}
                              {currencyFormatter.format(
                                recastSavings + lumpSum
                              )}
                            </p>
                            <p
                              className={
                                isInvestingBetter
                                  ? "text-green-600"
                                  : "text-red-600"
                              }
                            >
                              {isInvestingBetter
                                ? `Consider investing instead of recasting - you could earn ${currencyFormatter.format(
                                    investmentValue - (recastSavings + lumpSum)
                                  )} more`
                                : `Recasting might be better - you'd save ${currencyFormatter.format(
                                    recastSavings + lumpSum - investmentValue
                                  )} more than investing`}
                            </p>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
