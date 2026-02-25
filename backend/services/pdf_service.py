from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from io import BytesIO
from datetime import datetime


def create_projects_pdf(projects: list) -> BytesIO:
    """Generate PDF report for projects"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=20,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#0d9488')
    )
    
    elements = []
    
    # Title
    elements.append(Paragraph("Projects Report", title_style))
    elements.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Table data
    data = [['Project Name', 'Client', 'Status', 'Budget', 'Completion']]
    for p in projects:
        budget = f"${p.get('budget', 0):,.2f}" if p.get('budget') else "N/A"
        completion = f"{p.get('completion_percentage', 0):.1f}%"
        data.append([
            p.get('name', '')[:30],
            p.get('client_name', 'N/A')[:20],
            p.get('status', '').replace('_', ' ').title(),
            budget,
            completion
        ])
    
    # Create table
    table = Table(data, colWidths=[2*inch, 1.5*inch, 1*inch, 1*inch, 0.8*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0d9488')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')])
    ]))
    
    elements.append(table)
    
    # Summary
    elements.append(Spacer(1, 20))
    total = len(projects)
    active = len([p for p in projects if p.get('status') == 'active'])
    elements.append(Paragraph(f"<b>Total Projects:</b> {total} | <b>Active:</b> {active}", styles['Normal']))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer


def create_tasks_pdf(tasks: list) -> BytesIO:
    """Generate PDF report for tasks"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=20,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#0d9488')
    )
    
    elements = []
    
    # Title
    elements.append(Paragraph("Tasks Report", title_style))
    elements.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Table data
    data = [['Task Title', 'Status', 'Priority', 'Due Date']]
    for t in tasks:
        due = t.get('due_date', 'N/A') if t.get('due_date') else 'N/A'
        data.append([
            t.get('title', '')[:35],
            t.get('status', '').replace('_', ' ').title(),
            t.get('priority', '').title(),
            due
        ])
    
    # Create table
    table = Table(data, colWidths=[3*inch, 1.2*inch, 1*inch, 1*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0d9488')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')])
    ]))
    
    elements.append(table)
    
    # Summary
    elements.append(Spacer(1, 20))
    total = len(tasks)
    completed = len([t for t in tasks if t.get('status') == 'completed'])
    in_progress = len([t for t in tasks if t.get('status') == 'in_progress'])
    elements.append(Paragraph(
        f"<b>Total:</b> {total} | <b>Completed:</b> {completed} | <b>In Progress:</b> {in_progress}",
        styles['Normal']
    ))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer


def create_time_logs_pdf(logs: list) -> BytesIO:
    """Generate PDF report for time logs"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=20,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#0d9488')
    )
    
    elements = []
    
    # Title
    elements.append(Paragraph("Time Logs Report", title_style))
    elements.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Table data
    data = [['Date', 'Task ID', 'Duration', 'Billable', 'Description']]
    for log in logs:
        hours = log.get('duration_minutes', 0) / 60
        billable = 'Yes' if log.get('billable', True) else 'No'
        desc = log.get('description', '')[:25] if log.get('description') else 'N/A'
        data.append([
            log.get('date', 'N/A'),
            log.get('task_id', '')[-8:],
            f"{hours:.1f}h",
            billable,
            desc
        ])
    
    # Create table
    table = Table(data, colWidths=[1*inch, 1*inch, 0.8*inch, 0.7*inch, 2.5*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0d9488')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')])
    ]))
    
    elements.append(table)
    
    # Summary
    elements.append(Spacer(1, 20))
    total_hours = sum(log.get('duration_minutes', 0) for log in logs) / 60
    billable_hours = sum(log.get('duration_minutes', 0) for log in logs if log.get('billable', True)) / 60
    elements.append(Paragraph(
        f"<b>Total Hours:</b> {total_hours:.1f}h | <b>Billable:</b> {billable_hours:.1f}h",
        styles['Normal']
    ))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer


def create_team_productivity_pdf(team_data: list) -> BytesIO:
    """Generate PDF report for team productivity"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=20,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#0d9488')
    )
    
    elements = []
    
    # Title
    elements.append(Paragraph("Team Productivity Report", title_style))
    elements.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Table data
    data = [['Name', 'Role', 'Total Tasks', 'Completed', 'Hours']]
    for member in team_data:
        data.append([
            member.get('name', '')[:20],
            member.get('role', '').replace('_', ' ').title(),
            str(member.get('total_tasks', 0)),
            str(member.get('completed_tasks', 0)),
            f"{member.get('total_hours', 0):.1f}h"
        ])
    
    # Create table
    table = Table(data, colWidths=[2*inch, 1.2*inch, 1*inch, 1*inch, 0.8*inch])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#0d9488')),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.HexColor('#f8fafc')),
        ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
        ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('GRID', (0, 0), (-1, -1), 0.5, colors.HexColor('#e2e8f0')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f8fafc')])
    ]))
    
    elements.append(table)
    
    # Summary
    elements.append(Spacer(1, 20))
    total_tasks = sum(m.get('total_tasks', 0) for m in team_data)
    total_completed = sum(m.get('completed_tasks', 0) for m in team_data)
    total_hours = sum(m.get('total_hours', 0) for m in team_data)
    elements.append(Paragraph(
        f"<b>Team Total Tasks:</b> {total_tasks} | <b>Completed:</b> {total_completed} | <b>Hours:</b> {total_hours:.1f}h",
        styles['Normal']
    ))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer


def create_overview_pdf(overview_data: dict) -> BytesIO:
    """Generate PDF overview report"""
    buffer = BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, topMargin=0.5*inch, bottomMargin=0.5*inch)
    
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        'CustomTitle',
        parent=styles['Heading1'],
        fontSize=18,
        spaceAfter=20,
        alignment=TA_CENTER,
        textColor=colors.HexColor('#0d9488')
    )
    section_style = ParagraphStyle(
        'Section',
        parent=styles['Heading2'],
        fontSize=14,
        spaceBefore=15,
        spaceAfter=10,
        textColor=colors.HexColor('#334155')
    )
    
    elements = []
    
    # Title
    elements.append(Paragraph("Business Overview Report", title_style))
    elements.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Projects section
    elements.append(Paragraph("Projects", section_style))
    projects = overview_data.get('projects', {})
    elements.append(Paragraph(
        f"Total Projects: {projects.get('total', 0)} | Active: {projects.get('active', 0)}",
        styles['Normal']
    ))
    
    # Tasks section
    elements.append(Paragraph("Tasks", section_style))
    tasks = overview_data.get('tasks', {})
    elements.append(Paragraph(
        f"Total Tasks: {tasks.get('total', 0)} | Completed: {tasks.get('completed', 0)} | "
        f"Completion Rate: {tasks.get('completion_rate', 0):.1f}%",
        styles['Normal']
    ))
    
    # Time Tracking section
    elements.append(Paragraph("Time Tracking", section_style))
    time_data = overview_data.get('time', {})
    elements.append(Paragraph(
        f"Total Hours: {time_data.get('total_hours', 0):.1f}h | "
        f"Billable: {time_data.get('billable_hours', 0):.1f}h | "
        f"Non-Billable: {time_data.get('non_billable_hours', 0):.1f}h",
        styles['Normal']
    ))
    
    # Team section
    elements.append(Paragraph("Team", section_style))
    team = overview_data.get('team', {})
    elements.append(Paragraph(f"Total Team Members: {team.get('total', 0)}", styles['Normal']))
    
    # Finance section (if available)
    finance = overview_data.get('finance', {})
    if finance:
        elements.append(Paragraph("Finance", section_style))
        elements.append(Paragraph(
            f"Total Revenue: ${finance.get('total_revenue', 0):,.2f} | "
            f"Pending: ${finance.get('pending_revenue', 0):,.2f} | "
            f"Expenses: ${finance.get('total_expenses', 0):,.2f} | "
            f"Profit: ${finance.get('profit', 0):,.2f}",
            styles['Normal']
        ))
    
    doc.build(elements)
    buffer.seek(0)
    return buffer
