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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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
  newRate: z.coerce
    .number()
    .min(0, "Rate must be 0 or greater")
    .max(100, "Rate must be less than 100")
    .default(0),
  lumpSum: z.coerce.number().min(0, "Lump sum must be 0 or greater").default(0),
  estimatedClosingCosts: z.coerce
    .number()
    .min(0, "Closing costs must be 0 or greater")
    .default(0),
  useDetailedClosingCosts: z.boolean().default(false),
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

function TooltipLabel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 cursor-help">
            {label} <InfoIcon className="h-4 w-4" />
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs">{children}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
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
      newRate: 0,
      lumpSum: 0,
      estimatedClosingCosts: 0,
      useDetailedClosingCosts: false,
      refinanceClosingCosts: defaultRefinanceClosingCosts,
      recastFee: 250,
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
        data: {
          currentBalance: 0,
          currentRate: 0,
          monthlyPayment: 0,
          newRate: 0,
          lumpSum: 0,
          estimatedClosingCosts: 0,
          useDetailedClosingCosts: false,
          refinanceClosingCosts: defaultRefinanceClosingCosts,
          recastFee: 250,
        },
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
          newRate: 0,
          lumpSum: 0,
          estimatedClosingCosts: 0,
          useDetailedClosingCosts: false,
          refinanceClosingCosts: defaultRefinanceClosingCosts,
          recastFee: 250,
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
      !values.monthlyPayment
    ) {
      setResults(null);
      return;
    }

    const DEFAULT_TERM_MONTHS = 360; // 30 years

    const currentTotalInterest = calculateTotalInterest({
      principal: values.currentBalance,
      annualRate: values.currentRate,
      termMonths: DEFAULT_TERM_MONTHS,
      monthlyPayment: values.monthlyPayment,
    });

    // Calculate refinance closing costs
    let refinanceClosingCosts = values.estimatedClosingCosts;
    if (!refinanceClosingCosts) {
      // If no closing costs provided, use 3% of loan amount
      refinanceClosingCosts =
        values.currentBalance * REFINANCE_CLOSING_COSTS_PERCENTAGE;
    }

    // If detailed closing costs are provided, use their sum instead
    const detailedClosingCosts = Object.values(
      values.refinanceClosingCosts || {}
    ).reduce((sum, fee) => sum + (fee || 0), 0);
    if (detailedClosingCosts > 0) {
      refinanceClosingCosts = detailedClosingCosts;
    }

    // Calculate refinance option (applying lump sum to reduce principal)
    const refinancePrincipal = values.currentBalance - (values.lumpSum || 0);
    const refinanceMonthlyPayment = calculateMonthlyPayment({
      principal: refinancePrincipal,
      annualRate: values.newRate,
      termMonths: DEFAULT_TERM_MONTHS,
    });

    const refinanceTotalInterest = calculateTotalInterest({
      principal: refinancePrincipal,
      annualRate: values.newRate,
      termMonths: DEFAULT_TERM_MONTHS,
      monthlyPayment: refinanceMonthlyPayment,
    });

    const breakEvenMonths = calculateBreakEvenMonths(
      refinanceClosingCosts,
      values.monthlyPayment,
      refinanceMonthlyPayment
    );

    // Calculate recast option (applying lump sum to reduce principal)
    const recastMonthlyPayment = calculateRecastPayment({
      principal: values.currentBalance,
      annualRate: values.currentRate,
      termMonths: DEFAULT_TERM_MONTHS,
      extraPayment: values.lumpSum,
    });

    const recastTotalInterest = calculateTotalInterest({
      principal: values.currentBalance - values.lumpSum,
      annualRate: values.currentRate,
      termMonths: DEFAULT_TERM_MONTHS,
      monthlyPayment: recastMonthlyPayment,
    });

    // Calculate amortization schedules
    const currentSchedule = calculateAmortizationSchedule({
      principal: values.currentBalance,
      annualRate: values.currentRate,
      termMonths: DEFAULT_TERM_MONTHS,
      monthlyPayment: values.monthlyPayment,
    });

    const refinanceSchedule = calculateAmortizationSchedule({
      principal: refinancePrincipal,
      annualRate: values.newRate,
      termMonths: DEFAULT_TERM_MONTHS,
      monthlyPayment: refinanceMonthlyPayment,
    });

    const recastSchedule = calculateAmortizationSchedule({
      principal: values.currentBalance - values.lumpSum,
      annualRate: values.currentRate,
      termMonths: DEFAULT_TERM_MONTHS,
      monthlyPayment: recastMonthlyPayment,
    });

    setResults({
      current: {
        monthlyPayment: currencyFormatter.format(values.monthlyPayment),
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
    <div className="container mx-auto px-4 sm:px-6 lg:px-8">
      <Card>
        <CardHeader>
          <CardTitle>Refinance vs Recast Mortgage Calculator</CardTitle>
          <p className="text-muted-foreground mt-2">
            Compare your current mortgage with refinancing and recasting
            options. This calculator helps you make an informed decision by
            showing:
          </p>
          <ul className="list-disc list-inside mt-2 space-y-1">
            <li>Monthly payment differences</li>
            <li>Total interest savings</li>
            <li>Break-even period for refinancing</li>
            <li>Detailed payment breakdowns</li>
          </ul>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-2">Scenarios</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create and compare different mortgage scenarios. Double-click a
              scenario name to rename it. Use the copy button to create
              variations of your scenarios.
            </p>
            <ScenarioTabs
              scenarios={scenarios}
              activeScenario={activeScenarioId}
              onScenarioChange={handleScenarioChange}
              onScenarioAdd={handleScenarioAdd}
              onScenarioRename={handleScenarioRename}
              onScenarioDelete={handleScenarioDelete}
            />
          </div>
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
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <FormField
                  control={form.control}
                  name="currentBalance"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <TooltipLabel label="Current Mortgage Balance">
                          The remaining principal balance on your current
                          mortgage. This can be found on your most recent
                          mortgage statement or online banking portal.
                        </TooltipLabel>
                      </FormLabel>
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
                      <FormLabel>
                        <TooltipLabel label="Current Interest Rate">
                          Your current annual interest rate as a percentage. For
                          example, if your rate is 4.5%, enter 4.5.
                        </TooltipLabel>
                      </FormLabel>
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
                      <FormLabel>
                        <TooltipLabel label="Current Monthly Payment">
                          Your current monthly mortgage payment including
                          principal and interest. This can be found on your
                          mortgage statement.
                        </TooltipLabel>
                      </FormLabel>
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
                  name="newRate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <TooltipLabel label="New Interest Rate">
                          The new annual interest rate you're considering for
                          refinancing. Enter as a percentage (e.g., 3.5 for
                          3.5%).
                        </TooltipLabel>
                      </FormLabel>
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
                      <FormLabel>
                        <TooltipLabel label="Available Lump Sum">
                          The amount of money you have available to apply to
                          your mortgage principal. This will be used to
                          calculate both refinance and recast options.
                        </TooltipLabel>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          {...field}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value === "" ? 0 : Number(value));
                          }}
                        />
                      </FormControl>
                      <FormDescription>
                        This amount will be applied to reduce your principal
                        balance
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="estimatedClosingCosts"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <TooltipLabel label="Estimated Closing Costs">
                          The total cost of refinancing, including fees for
                          title insurance, appraisal, origination, and other
                          closing expenses.
                        </TooltipLabel>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder={(
                            form.getValues().currentBalance * 0.03
                          ).toFixed(2)}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Typically 2-5% of loan amount. Default is{" "}
                        <button
                          type="button"
                          className="text-blue-600 hover:text-blue-800 underline"
                          onClick={() => {
                            const value =
                              Math.round(
                                form.getValues().currentBalance * 0.03 * 100
                              ) / 100;
                            form.setValue("estimatedClosingCosts", value);
                          }}
                        >
                          3% (
                          {currencyFormatter.format(
                            form.getValues().currentBalance * 0.03
                          )}
                          )
                        </button>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Accordion type="single" collapsible className="w-full">
                  <AccordionItem value="closing-costs">
                    <AccordionTrigger>
                      <TooltipLabel label="Detailed Closing Costs Breakdown">
                        Break down your closing costs into specific categories
                        for more accurate calculations.
                      </TooltipLabel>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        <FormField
                          control={form.control}
                          name="refinanceClosingCosts.originationFee"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                <TooltipLabel label="Loan Origination Fee">
                                  A fee charged by the lender for processing
                                  your loan application. Typically 0.5-1% of the
                                  loan amount.
                                </TooltipLabel>
                              </FormLabel>
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
                          name="refinanceClosingCosts.titleInsurance"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                <TooltipLabel label="Title Insurance">
                                  Insurance that protects the lender and you
                                  against any title defects or claims on the
                                  property.
                                </TooltipLabel>
                              </FormLabel>
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
                              <FormLabel>
                                <TooltipLabel label="Appraisal Fee">
                                  Cost of a professional appraisal to determine
                                  the current market value of your property.
                                </TooltipLabel>
                              </FormLabel>
                              <FormControl>
                                <Input
                                  type="number"
                                  step="0.01"
                                  placeholder="0"
                                  {...field}
                                />
                              </FormControl>
                              <FormDescription>
                                Typically $300-$500
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="refinanceClosingCosts.recordingFees"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>
                                <TooltipLabel label="Recording Fees">
                                  Fees charged by the county or city to record
                                  the new mortgage documents.
                                </TooltipLabel>
                              </FormLabel>
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
                              <FormLabel>
                                <TooltipLabel label="Other Fees">
                                  Additional fees such as credit report, flood
                                  certification, tax service, and other
                                  miscellaneous charges.
                                </TooltipLabel>
                              </FormLabel>
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
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
                <FormField
                  control={form.control}
                  name="recastFee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        <TooltipLabel label="Recast Fee">
                          A one-time fee charged by your lender to recast your
                          mortgage after making a large principal payment.
                        </TooltipLabel>
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="250"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        One-time fee charged by the lender to recast your
                        mortgage. Typically $200-$500.
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
                      newRate: 0,
                      lumpSum: 0,
                      estimatedClosingCosts: 0,
                      useDetailedClosingCosts: false,
                      refinanceClosingCosts: defaultRefinanceClosingCosts,
                      recastFee: 250,
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
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
                      <p className="mt-2">
                        Monthly Savings:{" "}
                        <span className="text-green-600">
                          {currencyFormatter.format(
                            results.current.schedule[0].payment -
                              results.refinance.schedule[0].payment
                          )}
                        </span>
                      </p>
                      <p className="mt-2">
                        First 2 Years Total Savings:{" "}
                        <span className="text-green-600">
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
                        </span>
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
                      <p className="mt-2">
                        Monthly Savings:{" "}
                        <span className="text-green-600">
                          {currencyFormatter.format(
                            results.current.schedule[0].payment -
                              results.recast.schedule[0].payment
                          )}
                        </span>
                      </p>
                      <p className="mt-2">
                        First 2 Years Total Savings:{" "}
                        <span className="text-green-600">
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
                        </span>
                      </p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Payment Schedule Comparison
                </h3>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle">
                    <table className="min-w-full divide-y divide-gray-300">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="p-2 text-left border" colSpan={5}>
                            Current Mortgage
                          </th>
                          <th className="p-2 text-left border" colSpan={4}>
                            Refinance Option
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
                        </tr>
                      </thead>
                      <tbody>
                        {results.current.schedule
                          .slice(0, 24)
                          .map((current: ScheduleEntry, index: number) => {
                            const refinance = results.refinance.schedule[index];

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
                                  {currencyFormatter.format(
                                    refinance.principal
                                  )}
                                </td>
                                <td className="p-2 border">
                                  {currencyFormatter.format(refinance.interest)}
                                </td>
                                <td className="p-2 border text-sm">
                                  {refinanceRatio.principalPercentage}/
                                  {refinanceRatio.interestPercentage}
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
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
                <p className="text-sm text-gray-500 mt-2">
                  * Showing first 24 months. Principal builds equity in your
                  home, while interest is the cost of borrowing. The Ratio (P/I)
                  shows how your payment is split between Principal and
                  Interest.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
