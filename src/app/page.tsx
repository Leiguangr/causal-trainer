import Link from 'next/link'
import { Brain, Target, TrendingUp, BookOpen } from 'lucide-react'

export default function HomePage() {
  return (
    <main className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <Brain className="w-8 h-8 text-primary-600" />
            <span className="text-xl font-bold text-gray-900">Causal Trap Trainer</span>
          </div>
          <nav className="flex gap-4">
            <Link href="/login" className="text-gray-600 hover:text-gray-900">
              Login
            </Link>
            <Link
              href="/register"
              className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-4 py-20 text-center">
        <h1 className="text-5xl font-bold text-gray-900 mb-6">
          Master Causal Reasoning
        </h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          Learn to identify confounding, reverse causation, selection bias, and other
          causal traps through interactive quizzes based on Pearl&apos;s Causality Hierarchy.
        </p>
        <Link
          href="/register"
          className="inline-block bg-primary-600 text-white text-lg px-8 py-4 rounded-lg hover:bg-primary-700 transition-colors"
        >
          Start Training →
        </Link>
      </section>

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Target className="w-8 h-8 text-primary-600" />}
            title="Interactive Quizzes"
            description="Practice identifying trap types and subtypes with real-world scenarios from markets, medicine, law, and more."
          />
          <FeatureCard
            icon={<TrendingUp className="w-8 h-8 text-primary-600" />}
            title="Track Progress"
            description="See your accuracy by trap type, difficulty level, and Pearl level. Identify your weak areas and improve."
          />
          <FeatureCard
            icon={<BookOpen className="w-8 h-8 text-primary-600" />}
            title="Learn from Mistakes"
            description="Get detailed explanations for each question. Understand why your answer was right or wrong."
          />
        </div>
      </section>

      {/* Pearl Levels Preview */}
      <section className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-center text-gray-900 mb-12">
            Pearl&apos;s Causality Hierarchy
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <LevelCard
              level="L1"
              title="Association"
              description="Observational relationships. What patterns do we see in the data?"
              examples={['Confounding', 'Reverse Causation', 'Selection Bias']}
            />
            <LevelCard
              level="L2"
              title="Intervention"
              description="Causal effects of actions. What happens if we do X?"
              examples={['Unblocked Backdoor', 'Mediator Error', 'Feedback Loops']}
            />
            <LevelCard
              level="L3"
              title="Counterfactual"
              description="Reasoning about what-ifs. What would have happened if X had not occurred?"
              examples={['Preemption', 'Cross-world Confounding', 'Dynamic Divergence']}
            />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-600">
          <p>Built for CS372: AGI for Reasoning, Planning, and Decision Making</p>
          <p className="mt-2">Stanford University • Winter 2026</p>
        </div>
      </footer>
    </main>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm card-hover">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  )
}

function LevelCard({ level, title, description, examples }: { level: string; title: string; description: string; examples: string[] }) {
  return (
    <div className="bg-gray-50 p-6 rounded-xl border-2 border-gray-200">
      <div className="inline-block bg-primary-100 text-primary-700 text-sm font-semibold px-3 py-1 rounded-full mb-4">
        {level}
      </div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-4">{description}</p>
      <div className="flex flex-wrap gap-2">
        {examples.map((ex) => (
          <span key={ex} className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
            {ex}
          </span>
        ))}
      </div>
    </div>
  )
}

