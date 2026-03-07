import { Directive, ElementRef, OnDestroy, OnInit, input, output } from '@angular/core';

@Directive({
  selector: '[asInfiniteScroll]',
  standalone: true,
})
export class InfiniteScrollDirective implements OnInit, OnDestroy {
  enabled = input(true);
  rootMargin = input('30px');
  scrolledToBottom = output<void>();

  private observer: IntersectionObserver | null = null;

  constructor(private el: ElementRef<HTMLElement>) {}

  ngOnInit() {
    this.observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && this.enabled()) {
          this.scrolledToBottom.emit();
        }
      },
      { rootMargin: `0px 0px ${this.rootMargin()} 0px`, threshold: 0 }
    );
    this.observer.observe(this.el.nativeElement);
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}
