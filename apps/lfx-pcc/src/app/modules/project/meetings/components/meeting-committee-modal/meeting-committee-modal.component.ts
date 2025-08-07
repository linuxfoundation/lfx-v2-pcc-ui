// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal, Signal, WritableSignal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent } from '@components/button/button.component';
import { MultiSelectComponent } from '@components/multi-select/multi-select.component';
import { TableComponent } from '@components/table/table.component';
import { Committee, CommitteeMember, Meeting } from '@lfx-pcc/shared/interfaces';
import { CommitteeService } from '@services/committee.service';
import { MeetingService } from '@services/meeting.service';
import { ProjectService } from '@services/project.service';
import { MessageService } from 'primeng/api';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import { TooltipModule } from 'primeng/tooltip';
import { catchError, forkJoin, map, of, take, tap } from 'rxjs';

interface CommitteeMemberDisplay extends CommitteeMember {
  committeeName: string;
  committees?: string[];
}

@Component({
  selector: 'lfx-meeting-committee-modal',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonComponent, MultiSelectComponent, TableComponent, TooltipModule],
  templateUrl: './meeting-committee-modal.component.html',
  styleUrl: './meeting-committee-modal.component.scss',
})
export class MeetingCommitteeModalComponent {
  // Injected services
  private readonly ref = inject(DynamicDialogRef);
  private readonly config = inject(DynamicDialogConfig);
  private readonly committeeService = inject(CommitteeService);
  private readonly meetingService = inject(MeetingService);
  private readonly projectService = inject(ProjectService);
  private readonly messageService = inject(MessageService);

  // Inputs
  public readonly meeting: Meeting = this.config.data.meeting;

  // Class variables
  public saving: WritableSignal<boolean> = signal(false);
  public committeesLoading: WritableSignal<boolean> = signal(true);
  public selectedCommitteeIds: WritableSignal<string[]> = signal([]);
  public committeeMembers: WritableSignal<CommitteeMemberDisplay[]> = signal([]);
  public membersLoading: WritableSignal<boolean> = signal(false);
  public form: FormGroup;

  // Track loaded committees to avoid duplicate API calls
  private loadedCommitteeIds: Set<string> = new Set();
  private committeesMembersCache: Map<string, CommitteeMemberDisplay[]> = new Map();

  // Load committees using toSignal
  public committees: Signal<Committee[]> = toSignal(
    this.committeeService.getCommitteesByProject(this.projectService.project()?.id || '').pipe(
      tap(() => this.committeesLoading.set(false)),
      catchError((error) => {
        console.error('Failed to load committees:', error);
        this.messageService.add({
          severity: 'error',
          summary: 'Error',
          detail: 'Failed to load committees',
        });
        this.committeesLoading.set(false);
        return of([]);
      })
    ),
    { initialValue: [] }
  );

  // Computed signals
  public hasVotingEnabledCommittee = computed(() => {
    const selectedIds = this.selectedCommitteeIds();
    const committees = this.committees();
    return committees.some((c) => selectedIds.includes(c.id) && c.enable_voting);
  });

  public tableColspan = computed(() => {
    const hasVoting = this.hasVotingEnabledCommittee();
    const hasMultipleCommittees = this.selectedCommitteeIds().length > 1;

    if (hasVoting) {
      return 5; // Name, Organization, Committee, Role, Voting Status
    }

    if (hasMultipleCommittees) {
      return 3; // Name, Organization, Committee
    }

    return 2; // Name, Organization
  });

  public constructor() {
    this.form = new FormGroup({
      committees: new FormControl([]),
    });

    // Set initial selected committees
    if (this.meeting.meeting_committees && this.meeting.meeting_committees.length > 0) {
      const committeeIds = this.meeting.meeting_committees.map((c) => c.id);
      this.selectedCommitteeIds.set(committeeIds);
      this.form.patchValue({ committees: committeeIds });
      // Load members for initially selected committees
      this.loadCommitteeMembers(committeeIds);
    }

    // Subscribe to form value changes
    this.form
      .get('committees')
      ?.valueChanges.pipe(takeUntilDestroyed())
      .subscribe((committeeIds: string[]) => {
        this.selectedCommitteeIds.set(committeeIds || []);
        this.loadCommitteeMembers(committeeIds || []);
      });
  }

  public onCancel(): void {
    this.ref.close();
  }

  public onSave(): void {
    const selectedIds = this.form.value.committees as string[];

    // If no changes, just close
    const currentIds = this.meeting.meeting_committees?.map((c) => c.id) || [];
    if (JSON.stringify(selectedIds.sort()) === JSON.stringify(currentIds.sort())) {
      this.ref.close();
      return;
    }

    this.saving.set(true);

    // Build update request with all existing meeting fields plus committees
    const updateRequest = {
      project_id: this.meeting.project_id.toString(),
      topic: this.meeting.topic || '',
      agenda: this.meeting.agenda || undefined,
      start_time: this.meeting.start_time || '',
      duration: this.meeting.duration || 60,
      timezone: this.meeting.timezone || 'UTC',
      meeting_type: this.meeting.meeting_type || 'online',
      early_join_time: this.meeting.early_join_time || undefined,
      visibility: this.meeting.visibility || undefined,
      recording_enabled: this.meeting.recording_enabled || undefined,
      transcripts_enabled: this.meeting.transcripts_enabled || undefined,
      youtube_enabled: this.meeting.youtube_enabled || undefined,
      zoom_ai_enabled: this.meeting.zoom_ai_enabled || undefined,
      require_ai_summary_approval: this.meeting.require_ai_summary_approval || undefined,
      ai_summary_access: this.meeting.ai_summary_access || undefined,
      recording_access: this.meeting.recording_access || undefined,
      recurrence: this.meeting.recurrence || undefined,
      restricted: this.meeting.restricted || undefined,
      committees: selectedIds,
    };

    this.meetingService
      .updateMeeting(this.meeting.id, updateRequest)
      .pipe(take(1))
      .subscribe({
        next: () => {
          this.messageService.add({
            severity: 'success',
            summary: 'Success',
            detail: 'Meeting committees updated successfully',
          });
          this.saving.set(false);
          this.ref.close(true);
        },
        error: (error) => {
          console.error('Failed to update meeting committees:', error);
          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail: 'Failed to update meeting committees',
          });
          this.saving.set(false);
        },
      });
  }

  private loadCommitteeMembers(committeeIds: string[]): void {
    if (!committeeIds || committeeIds.length === 0) {
      this.committeeMembers.set([]);
      return;
    }

    this.membersLoading.set(true);

    // Determine which committees need to be loaded
    const committeesToLoad = committeeIds.filter((id) => !this.loadedCommitteeIds.has(id));

    if (committeesToLoad.length === 0) {
      // All committees are already loaded, just update the display
      this.updateMembersDisplay(committeeIds);
      this.membersLoading.set(false);
      return;
    }

    // Load members for committees that haven't been loaded yet
    const memberRequests = committeesToLoad.map((id) => {
      const committee = this.committees().find((c) => c.id === id);
      return this.committeeService.getCommitteeMembers(id).pipe(
        map((members) => {
          const membersWithCommittee = members.map((member) => ({
            ...member,
            committeeName: committee?.name || '',
          }));
          // Cache the results
          this.committeesMembersCache.set(id, membersWithCommittee);
          this.loadedCommitteeIds.add(id);
          return membersWithCommittee;
        }),
        catchError((error) => {
          console.error(`Failed to load members for committee ${id}:`, error);
          // Mark as loaded even on error to avoid repeated failed requests
          this.loadedCommitteeIds.add(id);
          return of([]);
        })
      );
    });

    if (memberRequests.length > 0) {
      forkJoin(memberRequests)
        .pipe(take(1))
        .subscribe(() => {
          this.updateMembersDisplay(committeeIds);
          this.membersLoading.set(false);
        });
    }
  }

  private updateMembersDisplay(committeeIds: string[]): void {
    // Collect all members from selected committees and deduplicate in a single pass
    const uniqueMembers = committeeIds
      .flatMap((id) => this.committeesMembersCache.get(id) || [])
      .reduce((acc: CommitteeMemberDisplay[], member) => {
        const existingMember = acc.find((m) => m.email === member.email);
        const committee = this.committees().find((c) => c.id === member.committee_id);
        const committeeName = committee?.name || '';

        if (!existingMember) {
          acc.push({
            ...member,
            committees: [committeeName],
          });
        } else {
          if (!existingMember.committees?.includes(committeeName)) {
            existingMember.committees?.push(committeeName);
          }
        }
        return acc;
      }, []);

    this.committeeMembers.set(uniqueMembers);
  }
}
