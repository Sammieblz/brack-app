import * as React from "react"
import { NavArrowRight, Home } from "iconoir-react"
import { Link, useLocation } from "react-router-dom"
import { cn } from "@/lib/utils"

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  className?: string;
}

export const Breadcrumbs = ({ items, className }: BreadcrumbsProps) => {
  const location = useLocation();
  
  // Auto-generate breadcrumbs from path if not provided
  const breadcrumbItems: BreadcrumbItem[] = items || (() => {
    const paths = location.pathname.split('/').filter(Boolean);
    const generated: BreadcrumbItem[] = [
      { label: 'Home', href: '/' }
    ];
    
    let currentPath = '';
    paths.forEach((path, index) => {
      currentPath += `/${path}`;
      const label = path
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      // Don't add current page as link
      if (index < paths.length - 1) {
        generated.push({ label, href: currentPath });
      } else {
        generated.push({ label });
      }
    });
    
    return generated;
  })();

  if (breadcrumbItems.length <= 1) return null;

  return (
    <nav 
      aria-label="Breadcrumb navigation" 
      className={cn("font-sans flex items-center gap-2 text-sm text-muted-foreground mb-4", className)}
    >
      <ol className="flex items-center gap-2 flex-wrap" itemScope itemType="https://schema.org/BreadcrumbList">
        {breadcrumbItems.map((item, index) => {
          const isLast = index === breadcrumbItems.length - 1;
          
          return (
            <li 
              key={index}
              className="flex items-center gap-2"
              itemProp="itemListElement"
              itemScope
              itemType="https://schema.org/ListItem"
            >
              {index === 0 ? (
                <Link
                  to={item.href || '/'}
                  className={cn(
                    "flex items-center gap-1 hover:text-foreground transition-colors",
                    isLast && "text-foreground font-medium"
                  )}
                  aria-label="Navigate to home"
                >
                  <Home className="h-4 w-4" />
                  <span className="font-sans" itemProp="name">{item.label}</span>
                </Link>
              ) : item.href && !isLast ? (
                <>
                  <NavArrowRight className="h-4 w-4" aria-hidden="true" />
                  <Link
                    to={item.href}
                    className="font-sans hover:text-foreground transition-colors"
                    itemProp="name"
                  >
                    {item.label}
                  </Link>
                </>
              ) : (
                <>
                  <NavArrowRight className="h-4 w-4" aria-hidden="true" />
                  <span 
                    className={cn("font-sans text-foreground font-medium", !item.href && "cursor-default")}
                    itemProp="name"
                    aria-current="page"
                  >
                    {item.label}
                  </span>
                </>
              )}
              <meta itemProp="position" content={String(index + 1)} />
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
