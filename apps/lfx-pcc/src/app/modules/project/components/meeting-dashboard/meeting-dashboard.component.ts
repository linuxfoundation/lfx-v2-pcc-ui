// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, Signal, WritableSignal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '@app/shared/components/button/button.component';
import { CardComponent } from '@app/shared/components/card/card.component';
import { FullcalendarComponent } from '@app/shared/components/fullcalendar/fullcalendar.component';
import { InputTextComponent } from '@app/shared/components/input-text/input-text.component';
import { MeetingCardComponent } from '@app/shared/components/meeting-card/meeting-card.component';
import { MeetingModalComponent } from '@app/shared/components/meeting-modal/meeting-modal.component';
import { MenuComponent } from '@app/shared/components/menu/menu.component';
import { SelectButtonComponent } from '@app/shared/components/select-button/select-button.component';
import { SelectComponent } from '@app/shared/components/select/select.component';
import { MeetingService } from '@app/shared/services/meeting.service';
import { ProjectService } from '@app/shared/services/project.service';
import { CalendarEvent, Meeting } from '@lfx-pcc/shared/interfaces';
import { AnimateOnScrollModule } from 'primeng/animateonscroll';
import { ConfirmationService, MenuItem } from 'primeng/api';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { DialogService } from 'primeng/dynamicdialog';
import { of } from 'rxjs';
import { debounceTime, distinctUntilChanged, startWith, tap } from 'rxjs/operators';

@Component({
  selector: 'lfx-meeting-dashboard',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    CardComponent,
    MenuComponent,
    MeetingCardComponent,
    InputTextComponent,
    SelectComponent,
    SelectButtonComponent,
    FullcalendarComponent,
    ButtonComponent,
    ConfirmDialogModule,
    AnimateOnScrollModule,
  ],
  templateUrl: './meeting-dashboard.component.html',
  styleUrl: './meeting-dashboard.component.scss',
})
export class MeetingDashboardComponent {
  // Injected services
  private readonly projectService = inject(ProjectService);
  private readonly meetingService = inject(MeetingService);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly dialogService = inject(DialogService);

  // Class variables with types
  public project: typeof this.projectService.project;
  public selectedMeeting: WritableSignal<Meeting | null>;
  public isDeleting: WritableSignal<boolean>;
  public searchForm: FormGroup;
  public visibilityFilter: WritableSignal<string | null>;
  public committeeFilter: WritableSignal<string | null>;
  private searchTerm: Signal<string>;
  public meetingsLoading: WritableSignal<boolean>;
  public meetings: Signal<Meeting[]>;
  public visibilityOptions: Signal<{ label: string; value: string | null }[]>;
  public committeeOptions: Signal<{ label: string; value: string | null }[]>;
  public filteredMeetings: Signal<Meeting[]>;
  public publicMeetingsCount: Signal<number>;
  public privateMeetingsCount: Signal<number>;
  public menuItems: MenuItem[];
  public actionMenuItems: MenuItem[];
  public currentView: WritableSignal<'list' | 'calendar'>;
  public viewOptions: { label: string; value: 'list' | 'calendar' }[];
  public viewForm: FormGroup;
  public calendarEvents: Signal<CalendarEvent[]>;

  public constructor() {
    // Initialize all class variables
    this.project = this.projectService.project;
    this.selectedMeeting = signal<Meeting | null>(null);
    this.isDeleting = signal<boolean>(false);
    this.meetingsLoading = signal<boolean>(true);
    this.meetings = this.initializeMeetings();
    this.searchForm = this.initializeSearchForm();
    this.visibilityFilter = signal<string | null>(null);
    this.committeeFilter = signal<string | null>(null);
    this.searchTerm = this.initializeSearchTerm();
    this.visibilityOptions = this.initializeVisibilityOptions();
    this.committeeOptions = this.initializeCommitteeOptions();
    this.filteredMeetings = this.initializeFilteredMeetings();
    this.publicMeetingsCount = this.initializePublicMeetingsCount();
    this.privateMeetingsCount = this.initializePrivateMeetingsCount();
    this.menuItems = this.initializeMenuItems();
    this.actionMenuItems = this.initializeActionMenuItems();
    this.currentView = signal<'list' | 'calendar'>('list');
    this.viewOptions = this.initializeViewOptions();
    this.viewForm = this.initializeViewForm();
    this.calendarEvents = this.initializeCalendarEvents();
  }

  public scheduleNewMeeting(): void {
    // TODO: Open create dialog when form is available
  }

  public onVisibilityChange(value: string | null): void {
    this.visibilityFilter.set(value);
  }

  public onCommitteeChange(value: string | null): void {
    this.committeeFilter.set(value);
  }

  public onMenuToggle(event: { event: Event; meeting: Meeting; menuComponent: MenuComponent }): void {
    this.selectedMeeting.set(event.meeting);
    event.menuComponent.toggle(event.event);
  }

  public onViewChange(value: 'list' | 'calendar'): void {
    this.currentView.set(value);
  }

  public onCalendarEventClick(eventInfo: any): void {
    const meetingId = eventInfo.event.extendedProps?.meetingId;
    if (meetingId) {
      const meeting = this.meetings().find((m) => m.id === meetingId);
      if (meeting) {
        this.selectedMeeting.set(meeting);
        this.openMeetingModal(meeting);
      }
    }
  }

  private openMeetingModal(meeting: Meeting): void {
    this.dialogService.open(MeetingModalComponent, {
      header: meeting.topic || 'Meeting Details',
      width: '700px',
      modal: true,
      closable: true,
      dismissableMask: true,
      data: {
        meeting: meeting,
        actionMenuItems: this.actionMenuItems,
      },
    });
  }

  // Action handlers
  private viewMeeting(): void {
    const meeting = this.selectedMeeting();
    if (meeting) {
      // TODO: Navigate to meeting details when route is available
    }
  }

  private editMeeting(): void {
    const meeting = this.selectedMeeting();
    if (meeting) {
      // TODO: Open edit dialog when form is available
    }
  }

  private deleteMeeting(): void {
    const meeting = this.selectedMeeting();
    if (!meeting) return;

    this.confirmationService.confirm({
      message: `Are you sure you want to delete this meeting? This action cannot be undone.`,
      header: 'Delete Meeting',
      acceptLabel: 'Delete',
      rejectLabel: 'Cancel',
      acceptButtonStyleClass: 'p-button-danger p-button-sm',
      rejectButtonStyleClass: 'p-button-outlined p-button-sm',
      accept: () => {
        // TODO: Implement delete when API endpoint is available
      },
    });
  }

  // Private initialization methods
  private initializeSearchForm(): FormGroup {
    return new FormGroup({
      search: new FormControl<string>(''),
      visibility: new FormControl<string | null>(null),
      committee: new FormControl<string | null>(null),
    });
  }

  private initializeSearchTerm(): Signal<string> {
    return toSignal(this.searchForm.get('search')!.valueChanges.pipe(startWith(''), debounceTime(300), distinctUntilChanged()), { initialValue: '' });
  }

  private initializeMeetings(): Signal<Meeting[]> {
    return toSignal(
      this.project()
        ? this.meetingService.getMeetingsByProject(this.project()!.id, undefined, 'start_time.asc.nullslast').pipe(tap(() => this.meetingsLoading.set(false)))
        : of([]),
      {
        initialValue: [],
      }
    );
  }

  private initializeVisibilityOptions(): Signal<{ label: string; value: string | null }[]> {
    return signal([
      { label: 'All Visibilities', value: null },
      { label: 'Public', value: 'public' },
      { label: 'Private', value: 'private' },
    ]);
  }

  private initializeCommitteeOptions(): Signal<{ label: string; value: string | null }[]> {
    return computed(() => {
      const meetings = this.meetings();
      const committeeMap = new Map<string, string>();

      // Extract unique committees from all meetings
      meetings.forEach((meeting) => {
        meeting.meeting_committees?.forEach((committee) => {
          committeeMap.set(committee.id, committee.name);
        });
      });

      // Convert to options array
      const options: { label: string; value: string | null }[] = [{ label: 'All Committees', value: null }];
      Array.from(committeeMap.entries())
        .sort(([, a], [, b]) => a.localeCompare(b))
        .forEach(([id, name]) => {
          options.push({ label: name, value: id });
        });

      return options;
    });
  }

  private initializeFilteredMeetings(): Signal<Meeting[]> {
    return computed(() => {
      let filtered = this.meetings();

      // Apply search filter
      const searchTerm = this.searchTerm()?.toLowerCase() || '';
      if (searchTerm) {
        filtered = filtered.filter(
          (meeting) =>
            meeting.topic?.toLowerCase().includes(searchTerm) ||
            meeting.agenda?.toLowerCase().includes(searchTerm) ||
            meeting.meeting_type?.toLowerCase().includes(searchTerm) ||
            meeting.meeting_committees?.some((committee) => committee.name.toLowerCase().includes(searchTerm))
        );
      }

      // Apply visibility filter
      const visibility = this.visibilityFilter();
      if (visibility) {
        filtered = filtered.filter((meeting) => meeting.visibility === visibility);
      }

      // Apply committee filter
      const committee = this.committeeFilter();
      if (committee) {
        filtered = filtered.filter((meeting) => meeting.meeting_committees?.some((c) => c.id === committee));
      }

      return filtered;
    });
  }

  private initializeMenuItems(): MenuItem[] {
    return [
      {
        label: 'Schedule Meeting',
        icon: 'fa-light fa-calendar-plus text-sm',
        command: () => this.scheduleNewMeeting(),
      },
      {
        label: 'Meeting History',
        icon: 'fa-light fa-calendar-days text-sm',
      },
      {
        label: 'Public Calendar',
        icon: 'fa-light fa-calendar-check text-sm',
      },
    ];
  }

  private initializeActionMenuItems(): MenuItem[] {
    return [
      {
        label: 'View',
        icon: 'fa-light fa-eye',
        command: () => this.viewMeeting(),
      },
      {
        label: 'Edit',
        icon: 'fa-light fa-edit',
        command: () => this.editMeeting(),
      },
      {
        separator: true,
      },
      {
        label: 'Delete',
        icon: 'fa-light fa-trash',
        styleClass: 'text-red-500',
        disabled: this.isDeleting(),
        command: () => this.deleteMeeting(),
      },
    ];
  }

  private initializePublicMeetingsCount(): Signal<number> {
    return computed(() => this.meetings().filter((m) => m.visibility === 'public').length);
  }

  private initializePrivateMeetingsCount(): Signal<number> {
    return computed(() => this.meetings().filter((m) => m.visibility === 'private').length);
  }

  private initializeViewOptions(): { label: string; value: 'list' | 'calendar' }[] {
    return [
      { label: 'List', value: 'list' },
      { label: 'Calendar', value: 'calendar' },
    ];
  }

  private initializeViewForm(): FormGroup {
    return new FormGroup({
      view: new FormControl<'list' | 'calendar'>('list'),
    });
  }

  private initializeCalendarEvents(): Signal<CalendarEvent[]> {
    return computed(() => {
      return this.filteredMeetings().map((meeting): CalendarEvent => {
        const startTime = meeting.start_time ? new Date(meeting.start_time) : new Date();
        const endTime = meeting.end_time ? new Date(meeting.end_time) : new Date(startTime.getTime() + 60 * 60 * 1000); // Default 1 hour duration

        // Color coding based on visibility and committee
        let backgroundColor = '#6b7280'; // Default gray for private
        let borderColor = '#374151';

        if (meeting.visibility === 'public') {
          backgroundColor = '#3b82f6'; // Blue for public
          borderColor = '#1d4ed8';
        } else if (meeting.visibility === 'restricted') {
          backgroundColor = '#f59e0b'; // Amber for restricted
          borderColor = '#d97706';
        }

        // Create a more informative title
        const committeeName = meeting.meeting_committees?.[0]?.name;
        const displayTitle = committeeName ? `${meeting.topic || 'Meeting'} (${committeeName})` : meeting.topic || 'Meeting';

        return {
          id: meeting.id,
          title: displayTitle,
          start: startTime.toISOString(),
          end: endTime.toISOString(),
          backgroundColor,
          borderColor,
          textColor: '#ffffff',
          classNames: ['meeting-event'],
          extendedProps: {
            meetingId: meeting.id,
            visibility: meeting.visibility || 'private',
            committee: meeting.meeting_committees?.[0]?.name,
            meetingType: meeting.meeting_type,
            agenda: meeting.agenda,
            topic: meeting.topic,
          },
        };
      });
    });
  }
}
