import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HelloD3 } from './hello-d3';

describe('HelloD3', () => {
  let component: HelloD3;
  let fixture: ComponentFixture<HelloD3>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HelloD3]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HelloD3);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
