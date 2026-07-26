// app/page.tsx
import Link from "next/link";

const features = [
  {
    icon: "🏠",
    title: "Familles d'accueil",
    description:
      "Gérez vos familles d'accueil, suivez leurs disponibilités et les animaux qui leur sont confiés.",
  },
  {
    icon: "📦",
    title: "Stock & Matériel",
    description:
      "Suivez votre inventaire de nourriture, médicaments et équipements en temps réel.",
  },
  {
    icon: "🐾",
    title: "Prise en charge",
    description:
      "Enregistrez et suivez chaque animal pris en charge, de l'arrivée jusqu'à l'adoption.",
  },
  {
    icon: "💰",
    title: "Finances",
    description:
      "Gérez vos dons, dépenses et générez des rapports financiers clairs.",
  },
];

// const stats = [
//   { value: "200+", label: "Animaux sauvés" },
//   { value: "80+", label: "Familles d'accueil" },
//   { value: "50+", label: "Adoptions réussies" },
//   { value: "15k€", label: "Dons collectés" },
// ];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* NAVBAR */}
      <nav className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🐾</span>
            <span className="text-xl font-bold text-gray-800">
              Anim<span className="text-emerald-500">Admin</span>
            </span>
          </div>
          <Link
            href="/connexion"
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-semibold px-6 py-2 rounded-full transition-colors duration-200"
          >
            Connexion
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-24 flex flex-col items-center text-center gap-6">
          <span className="bg-emerald-100 text-emerald-700 text-sm font-medium px-4 py-1 rounded-full">
            Outil dédié aux associations de protection animale
          </span>
          <h1 className="text-5xl font-extrabold text-gray-900 leading-tight max-w-3xl">
            Gérez votre association{" "}
            <span className="text-emerald-500">simplement</span> et{" "}
            <span className="text-emerald-500">efficacement</span>
          </h1>
          <p className="text-gray-500 text-lg max-w-xl">
            Une plateforme tout-en-un pour suivre vos familles d'accueil, vos
            animaux, votre stock et vos finances — pour vous concentrer sur
            l'essentiel.
          </p>
          <Link
            href="/login"
            className="mt-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-10 py-4 rounded-full text-lg transition-colors duration-200 shadow-md hover:shadow-lg"
          >
            Accéder à mon espace →
          </Link>
        </div>
      </section>

      {/* STATS */}
      <section className="bg-emerald-500">
        <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {/* {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-4xl font-extrabold text-white">{stat.value}</p>
              <p className="text-emerald-100 mt-1 text-sm">{stat.label}</p>
            </div>
          ))} */}
        </div>
      </section>

      {/* FEATURES */}
      <section className="max-w-6xl mx-auto px-6 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold text-gray-900">
            Tout ce dont vous avez besoin
          </h2>
          <p className="text-gray-500 mt-3">
            Quatre modules pensés pour le quotidien de votre association.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col gap-4"
            >
              <div className="text-4xl">{feature.icon}</div>
              <h3 className="text-lg font-bold text-gray-800">
                {feature.title}
              </h3>
              <p className="text-gray-500 text-sm leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gray-900 text-white">
        <div className="max-w-6xl mx-auto px-6 py-20 flex flex-col items-center text-center gap-6">
          <span className="text-5xl">🐶🐱</span>
          <h2 className="text-3xl font-bold">
            Prêt à simplifier la gestion de votre association ?
          </h2>
          <p className="text-gray-400 max-w-md">
            Connectez-vous dès maintenant et retrouvez toutes vos informations
            en un seul endroit.
          </p>
          <Link
            href="/login"
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-10 py-4 rounded-full text-lg transition-colors duration-200"
          >
            Se connecter
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="bg-gray-800 text-gray-400 text-sm">
        <div className="max-w-6xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span>🐾</span>
            <span className="font-semibold text-white">AnimAdmin</span>
          </div>
          <p>© {new Date().getFullYear()} — Fait avec ❤️ pour les animaux</p>
        </div>
      </footer>
    </div>
  );
}
