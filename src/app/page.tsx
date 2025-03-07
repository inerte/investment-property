import { MortgageCalculator } from "@/components/MortgageCalculator";

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 py-8">
      <div className="container mx-auto px-4">
        <h1 className="text-4xl font-bold text-center mb-8">
          Investment Property Calculator
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Compare your mortgage options: refinancing vs recasting
        </p>
        <MortgageCalculator />
      </div>
    </main>
  );
}
