"use client";

import { cn } from "@fitnudge/ui";

type SidebarToggleIconProps = {
  /** True when sidebar is collapsed (closed) */
  collapsed: boolean;
  className?: string;
};

/**
 * Sidebar toggle icon: [|] at rest, [<-] on hover when open, [->] on hover when closed.
 * Parent button must have className="group" for hover transforms to work.
 */
export function SidebarToggleIcon({
  collapsed,
  className,
}: SidebarToggleIconProps) {
  return (
    <span className={cn("relative inline-flex h-5 w-5 shrink-0 overflow-hidden", className)}>
      {/* Panel/rectangle background */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="none"
        className="absolute inset-0 h-full w-full text-current opacity-30"
      >
        <path
          fill="currentColor"
          d="M15.25 3H4.75A2.752 2.752 0 0 0 2 5.75v8.5A2.752 2.752 0 0 0 4.75 17h10.5A2.752 2.752 0 0 0 18 14.25v-8.5A2.752 2.752 0 0 0 15.25 3Z"
        />
      </svg>
      {/* Vertical bar [|] - visible at rest, slides out on hover */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="none"
        className="absolute inset-0 h-full w-full text-current opacity-100 transition-all duration-200 group-hover:opacity-0 group-hover:translate-x-4"
      >
        <path
          fill="currentColor"
          d="M7.19 13.2c0 .442.357.8.798.8.441 0 .798-.358.798-.8V6.8c0-.442-.357-.8-.798-.8-.441 0-.798.358-.798.8v6.4Z"
        />
      </svg>
      {/* Left arrow [<-] - hover when open */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="none"
        className={cn(
          "absolute inset-0 h-full w-full text-current transition-all duration-200",
          collapsed ? "opacity-0 translate-x-4" : "opacity-0 -translate-x-4 group-hover:opacity-100 group-hover:translate-x-0"
        )}
      >
        <path
          fill="currentColor"
          d="M9.29883 6.64118C9.59173 6.34841 10.0665 6.34833 10.3594 6.64118C10.6521 6.93403 10.6521 7.40885 10.3594 7.70172L8.81152 9.24957H13C13.4141 9.24957 13.7498 9.58551 13.75 9.99957C13.75 10.4138 13.4142 10.7496 13 10.7496H8.81152L10.3594 12.2984C10.652 12.5913 10.6522 13.0661 10.3594 13.3589C10.0666 13.6517 9.59172 13.6515 9.29883 13.3589L6.46973 10.5298C6.4333 10.4934 6.40138 10.4541 6.37402 10.4127L6.30957 10.2916C6.30877 10.2897 6.3084 10.2876 6.30762 10.2857C6.30017 10.2676 6.29602 10.2485 6.29004 10.23C6.26647 10.1572 6.25 10.0802 6.25 9.99957C6.25004 9.9188 6.26637 9.842 6.29004 9.76911C6.29558 9.75199 6.29886 9.73411 6.30566 9.71735L6.30957 9.70758C6.31882 9.68575 6.33157 9.6658 6.34277 9.64508C6.37653 9.58257 6.41692 9.52212 6.46973 9.4693L9.29883 6.64118Z"
        />
      </svg>
      {/* Right arrow [->] - hover when closed */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="none"
        className={cn(
          "absolute inset-0 h-full w-full text-current transition-all duration-200",
          collapsed ? "opacity-0 translate-x-4 group-hover:opacity-100 group-hover:translate-x-0" : "opacity-0 translate-x-4"
        )}
      >
        <path
          fill="currentColor"
          d="M10.7012 6.64118C10.4083 6.34841 9.9335 6.34833 9.6406 6.64118C9.3479 6.93403 9.3479 7.40885 9.6406 7.70172L11.1885 9.24957H7C6.58594 9.24957 6.2502 9.58551 6.25 9.99957C6.25 10.4138 6.5858 10.7496 7 10.7496H11.1885L9.6406 12.2984C9.348 12.5913 9.3478 13.0661 9.6406 13.3589C9.9334 13.6517 10.4083 13.6515 10.7012 13.3589L13.5303 10.5298C13.5667 10.4934 13.5986 10.4541 13.626 10.4127L13.6904 10.2916C13.6912 10.2897 13.6916 10.2876 13.6924 10.2857C13.6998 10.2676 13.704 10.2485 13.71 10.23C13.7335 10.1572 13.75 10.0802 13.75 9.99957C13.75 9.9188 13.7336 9.842 13.71 9.76911C13.7044 9.75199 13.7011 9.73411 13.6943 9.71735L13.6904 9.70758C13.6812 9.68575 13.6684 9.6658 13.6572 9.64508C13.6235 9.58257 13.5831 9.52212 13.5303 9.4693L10.7012 6.64118Z"
        />
      </svg>
    </span>
  );
}
