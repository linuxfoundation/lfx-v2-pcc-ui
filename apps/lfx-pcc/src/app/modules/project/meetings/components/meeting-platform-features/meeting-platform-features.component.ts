// Copyright The Linux Foundation and each contributor to LFX.
// SPDX-License-Identifier: MIT

import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, input, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { SelectComponent } from '@components/select/select.component';
import { ToggleComponent } from '@components/toggle/toggle.component';
import { AI_SUMMARY_ACCESS_OPTIONS, MEETING_FEATURES, MEETING_PLATFORMS, RECORDING_ACCESS_OPTIONS } from '@lfx-pcc/shared/constants';
import { TooltipModule } from 'primeng/tooltip';

@Component({
  selector: 'lfx-meeting-platform-features',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, SelectComponent, ToggleComponent, TooltipModule],
  templateUrl: './meeting-platform-features.component.html',
})
export class MeetingPlatformFeaturesComponent implements OnInit {
  private readonly destroyRef = inject(DestroyRef);
  // Form group input from parent
  public readonly form = input.required<FormGroup>();

  // Constants from shared package
  public readonly platformOptions = MEETING_PLATFORMS;
  public readonly features = MEETING_FEATURES;
  public readonly recordingAccessOptions = RECORDING_ACCESS_OPTIONS;
  public readonly aiSummaryAccessOptions = AI_SUMMARY_ACCESS_OPTIONS;

  public selectPlatform(platform: string): void {
    const platformOption = this.platformOptions.find((p) => p.value === platform);
    if (platformOption?.available) {
      this.form().get('meetingTool')?.setValue(platform);
    }
  }

  public ngOnInit(): void {
    // Watch for recording_enabled changes to disable dependent features
    this.form()
      .get('recording_enabled')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((recordingEnabled: boolean) => {
        const dependentControls = ['transcripts_enabled', 'zoom_ai_enabled', 'youtube_enabled'];

        dependentControls.forEach((controlName) => {
          const control = this.form().get(controlName);
          if (control) {
            if (!recordingEnabled) {
              // Disable and reset dependent features when recording is disabled
              control.setValue(false);
              control.disable();
            } else {
              // Re-enable dependent features when recording is enabled
              control.enable();
            }

            control.updateValueAndValidity();
          }
        });
      });
  }

  public toggleFeature(featureKey: string, enabled: boolean): void {
    this.form().get(featureKey)?.setValue(enabled);
  }
}
