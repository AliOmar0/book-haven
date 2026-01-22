import { BookOpen, Users, Library, Star } from 'lucide-react';

const stats = [
  { 
    icon: BookOpen, 
    value: '70,000+', 
    label: 'Free Books',
    description: 'From Project Gutenberg & Standard Ebooks'
  },
  { 
    icon: Users, 
    value: 'Millions', 
    label: 'Readers',
    description: 'Worldwide community of book lovers'
  },
  { 
    icon: Library, 
    value: '100+', 
    label: 'Categories',
    description: 'Genres and subjects to explore'
  },
  { 
    icon: Star, 
    value: '4.8', 
    label: 'Average Rating',
    description: 'For our classic literature collection'
  },
];

export function StatsSection() {
  return (
    <section className="py-12 bg-gradient-to-r from-primary/5 via-card to-secondary/5 rounded-2xl border border-border/30">
      <div className="container">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <div 
                key={index} 
                className="text-center space-y-2 animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="inline-flex p-3 rounded-full bg-primary/10 text-primary mb-2">
                  <Icon className="h-5 w-5 md:h-6 md:w-6" />
                </div>
                <div className="font-serif text-2xl md:text-3xl font-bold text-foreground">
                  {stat.value}
                </div>
                <div className="font-medium text-foreground">{stat.label}</div>
                <p className="text-xs text-muted-foreground hidden md:block">
                  {stat.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
