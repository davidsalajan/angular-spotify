import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AnnotationToggleComponent } from './annotation-toggle.component';
import { AnnotatorConfig, LyricsAnnotationStore, ROMAJI_ANNOTATOR, PINYIN_ANNOTATOR } from '@angular-spotify/web/lyrics/data-access';

describe('AnnotationToggleComponent', () => {
  let fixture: ComponentFixture<AnnotationToggleComponent>;
  let component: AnnotationToggleComponent;

  const showToggle$ = new BehaviorSubject<boolean>(true);
  const enabled$ = new BehaviorSubject<boolean>(true);
  const activeAnnotator$ = new BehaviorSubject<AnnotatorConfig | null>(PINYIN_ANNOTATOR);
  const setEnabledSpy = jest.fn();

  const storeMock = {
    showToggle$: showToggle$.asObservable(),
    enabled$: enabled$.asObservable(),
    activeAnnotator$: activeAnnotator$.asObservable(),
    setEnabled: setEnabledSpy
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    showToggle$.next(true);
    enabled$.next(true);
    activeAnnotator$.next(PINYIN_ANNOTATOR);

    await TestBed.configureTestingModule({
      declarations: [AnnotationToggleComponent],
      providers: [{ provide: LyricsAnnotationStore, useValue: storeMock }],
      schemas: [NO_ERRORS_SCHEMA]
    }).compileComponents();

    fixture = TestBed.createComponent(AnnotationToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create with selector as-annotation-toggle', () => {
    expect(component).toBeTruthy();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const cmp = (AnnotationToggleComponent as any)['ɵcmp'];
    expect(cmp.selectors[0][0]).toBe('as-annotation-toggle');
  });

  it('hides the button when showToggle$ is false', () => {
    showToggle$.next(false);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('button'))).toBeNull();
  });

  it('hides the button when there is no active annotator', () => {
    activeAnnotator$.next(null);
    fixture.detectChanges();
    expect(fixture.debugElement.query(By.css('button'))).toBeNull();
  });

  it('renders the pinyin icon for the pinyin annotator', () => {
    fixture.detectChanges();
    const label = fixture.debugElement.query(By.css('.annotation-toggle-label'));
    expect(label.nativeElement.textContent.trim()).toBe('拼');
  });

  it('renders the romaji icon for the romaji annotator', () => {
    activeAnnotator$.next(ROMAJI_ANNOTATOR);
    fixture.detectChanges();
    const label = fixture.debugElement.query(By.css('.annotation-toggle-label'));
    expect(label.nativeElement.textContent.trim()).toBe('あ');
  });

  it('marks the button active when enabled', () => {
    enabled$.next(true);
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('button'));
    expect(btn.nativeElement.classList).toContain('active');
  });

  it('does not mark the button active when disabled', () => {
    enabled$.next(false);
    fixture.detectChanges();
    const btn = fixture.debugElement.query(By.css('button'));
    expect(btn.nativeElement.classList).not.toContain('active');
  });

  it('calls setEnabled with the toggled value on click', () => {
    enabled$.next(true);
    fixture.detectChanges();
    fixture.debugElement.query(By.css('button')).triggerEventHandler('click', null);
    expect(setEnabledSpy).toHaveBeenCalledWith(false);
  });

  it('calls setEnabled(true) when currently disabled', () => {
    enabled$.next(false);
    fixture.detectChanges();
    fixture.debugElement.query(By.css('button')).triggerEventHandler('click', null);
    expect(setEnabledSpy).toHaveBeenCalledWith(true);
  });

  describe('tooltip copy comes from the annotator config', () => {
    it('uses tooltipHide when enabled', () => {
      activeAnnotator$.next(ROMAJI_ANNOTATOR);
      enabled$.next(true);
      fixture.detectChanges();
      expect(ROMAJI_ANNOTATOR.toggle.tooltipHide).toBe('Hide romaji');
    });

    it('uses tooltipShow when disabled', () => {
      activeAnnotator$.next(ROMAJI_ANNOTATOR);
      enabled$.next(false);
      fixture.detectChanges();
      expect(ROMAJI_ANNOTATOR.toggle.tooltipShow).toBe('Show romaji');
    });
  });
});
