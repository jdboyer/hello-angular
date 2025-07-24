import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HelloCanvas } from './hello-canvas';

describe('HelloCanvas', () => {
  let component: HelloCanvas;
  let fixture: ComponentFixture<HelloCanvas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HelloCanvas]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HelloCanvas);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
