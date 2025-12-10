"""
Data Export Service

Handles exporting traffic data in various formats:
- CSV (for Excel/spreadsheets)
- JSON (for developers/APIs)
- PDF (for reports)
"""

import csv
import json
import io
from datetime import datetime
from typing import Optional
from ..models.traffic import TrafficFlowData, RoadSegment, TrafficIncident


def export_to_csv(data: TrafficFlowData, incidents: Optional[list[TrafficIncident]] = None) -> str:
    """
    Export traffic data to CSV format.
    
    Args:
        data: TrafficFlowData to export
        incidents: Optional list of incidents to include
    
    Returns:
        CSV string
    """
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Header
    writer.writerow([
        'Segment ID',
        'Road Name',
        'Current Speed (km/h)',
        'Free Flow Speed (km/h)',
        'Speed Ratio (%)',
        'Congestion Level',
        'Delay (seconds)',
        'Current Travel Time (s)',
        'Free Flow Travel Time (s)',
        'Road Type',
        'Coordinates (lat,lng pairs)',
    ])
    
    # Data rows
    for segment in data.segments:
        coords_str = '; '.join([f"{c.lat:.6f},{c.lng:.6f}" for c in segment.coordinates])
        writer.writerow([
            segment.id,
            segment.name or '',
            segment.current_speed,
            segment.free_flow_speed,
            round(segment.speed_ratio * 100, 2),
            segment.congestion_level,
            segment.delay_seconds,
            segment.current_travel_time,
            segment.free_flow_travel_time,
            segment.road_type or '',
            coords_str,
        ])
    
    # Incidents section
    if incidents:
        writer.writerow([])  # Empty row
        writer.writerow(['INCIDENTS'])
        writer.writerow([
            'ID',
            'Type',
            'Latitude',
            'Longitude',
            'Description',
            'Severity',
            'Start Time',
            'End Time',
        ])
        
        for incident in incidents:
            writer.writerow([
                incident.id,
                incident.type,
                incident.coordinates.lat,
                incident.coordinates.lng,
                incident.description or '',
                incident.severity,
                incident.start_time.isoformat() if incident.start_time else '',
                incident.end_time.isoformat() if incident.end_time else '',
            ])
    
    # Summary section
    writer.writerow([])
    writer.writerow(['SUMMARY'])
    writer.writerow(['Total Segments', data.total_segments])
    writer.writerow(['Congested Segments', data.congested_segments])
    writer.writerow(['Average Speed Ratio', f"{data.average_speed_ratio * 100:.2f}%"])
    writer.writerow(['Timestamp', data.timestamp.isoformat()])
    
    return output.getvalue()


def export_to_json(data: TrafficFlowData, incidents: Optional[list[TrafficIncident]] = None) -> str:
    """
    Export traffic data to JSON format.
    
    Args:
        data: TrafficFlowData to export
        incidents: Optional list of incidents to include
    
    Returns:
        JSON string (pretty-printed)
    """
    export_data = {
        'metadata': {
            'exported_at': datetime.utcnow().isoformat(),
            'source': data.source,
            'bounding_box': {
                'north': data.bounding_box.north,
                'south': data.bounding_box.south,
                'east': data.bounding_box.east,
                'west': data.bounding_box.west,
            },
            'summary': {
                'total_segments': data.total_segments,
                'congested_segments': data.congested_segments,
                'average_speed_ratio': data.average_speed_ratio,
            },
        },
        'segments': [
            {
                'id': s.id,
                'name': s.name,
                'coordinates': [[c.lat, c.lng] for c in s.coordinates],
                'current_speed': s.current_speed,
                'free_flow_speed': s.free_flow_speed,
                'speed_ratio': s.speed_ratio,
                'congestion_level': s.congestion_level,
                'delay_seconds': s.delay_seconds,
                'current_travel_time': s.current_travel_time,
                'free_flow_travel_time': s.free_flow_travel_time,
                'road_type': s.road_type,
            }
            for s in data.segments
        ],
    }
    
    if incidents:
        export_data['incidents'] = [
            {
                'id': i.id,
                'type': i.type,
                'coordinates': {'lat': i.coordinates.lat, 'lng': i.coordinates.lng},
                'description': i.description,
                'severity': i.severity,
                'start_time': i.start_time.isoformat() if i.start_time else None,
                'end_time': i.end_time.isoformat() if i.end_time else None,
            }
            for i in incidents
        ]
    
    return json.dumps(export_data, indent=2, default=str)


def export_to_pdf(data: TrafficFlowData, incidents: Optional[list[TrafficIncident]] = None) -> bytes:
    """
    Export traffic data to PDF format.
    
    Note: This is a simple implementation. For production, consider using
    reportlab or weasyprint for better formatting.
    
    Args:
        data: TrafficFlowData to export
        incidents: Optional list of incidents to include
    
    Returns:
        PDF bytes
    """
    # For now, return a simple text-based PDF
    # In production, use reportlab or weasyprint for proper PDF generation
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
    from reportlab.lib.styles import getSampleStyleSheet
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter)
    story = []
    styles = getSampleStyleSheet()
    
    # Title
    title = Paragraph("Traffic Flow Report", styles['Title'])
    story.append(title)
    story.append(Spacer(1, 0.2 * inch))
    
    # Summary
    summary_data = [
        ['Metric', 'Value'],
        ['Total Segments', str(data.total_segments)],
        ['Congested Segments', str(data.congested_segments)],
        ['Average Speed Ratio', f"{data.average_speed_ratio * 100:.2f}%"],
        ['Timestamp', data.timestamp.strftime('%Y-%m-%d %H:%M:%S UTC')],
    ]
    
    summary_table = Table(summary_data)
    summary_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 12),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
    ]))
    story.append(summary_table)
    story.append(Spacer(1, 0.3 * inch))
    
    # Segments table (first 50)
    story.append(Paragraph("Road Segments (showing first 50)", styles['Heading2']))
    
    segment_data = [['Road Name', 'Speed (km/h)', 'Congestion', 'Delay (s)']]
    for segment in data.segments[:50]:  # Limit to 50 for PDF
        segment_data.append([
            segment.name or segment.id[:8],
            f"{segment.current_speed}/{segment.free_flow_speed}",
            segment.congestion_level,
            str(segment.delay_seconds),
        ])
    
    segment_table = Table(segment_data)
    segment_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('FONTSIZE', (0, 1), (-1, -1), 8),
        ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
        ('BACKGROUND', (0, 1), (-1, -1), colors.white),
        ('GRID', (0, 0), (-1, -1), 1, colors.black),
    ]))
    story.append(segment_table)
    
    # Incidents
    if incidents:
        story.append(Spacer(1, 0.3 * inch))
        story.append(Paragraph("Traffic Incidents", styles['Heading2']))
        
        incident_data = [['Type', 'Location', 'Severity', 'Description']]
        for incident in incidents:
            incident_data.append([
                incident.type,
                f"{incident.coordinates.lat:.4f}, {incident.coordinates.lng:.4f}",
                str(incident.severity),
                incident.description or '',
            ])
        
        incident_table = Table(incident_data)
        incident_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 10),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        story.append(incident_table)
    
    doc.build(story)
    buffer.seek(0)
    return buffer.read()

