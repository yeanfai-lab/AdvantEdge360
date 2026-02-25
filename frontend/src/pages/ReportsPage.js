import React, { useEffect, useState, useMemo, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { Badge } from '../components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FileText, TrendingUp, Users, Clock, Download, ChevronDown, GripVertical, Plus, X, BarChart3, Table as TableIcon, FileSpreadsheet, RefreshCw, Filter, ArrowUpDown, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

// Available modules and their fields
const REPORT_MODULES = {
  clients: {
    label: 'Clients',
    fields: [
      { id: 'name', label: 'Client Name', type: 'string' },
      { id: 'email', label: 'Email', type: 'string' },
      { id: 'phone', label: 'Phone', type: 'string' },
      { id: 'company_name', label: 'Company', type: 'string' },
      { id: 'position', label: 'Position', type: 'string' },
      { id: 'gst_number', label: 'GST Number', type: 'string' },
      { id: 'pan_number', label: 'PAN Number', type: 'string' },
      { id: 'status', label: 'Status', type: 'string' },
      { id: 'created_at', label: 'Created Date', type: 'date' }
    ]
  },
  companies: {
    label: 'Companies',
    fields: [
      { id: 'name', label: 'Company Name', type: 'string' },
      { id: 'industry', label: 'Industry', type: 'string' },
      { id: 'website', label: 'Website', type: 'string' },
      { id: 'phone', label: 'Phone', type: 'string' },
      { id: 'business_address', label: 'Address', type: 'string' },
      { id: 'gst_number', label: 'GST Number', type: 'string' },
      { id: 'pan_number', label: 'PAN Number', type: 'string' },
      { id: 'status', label: 'Status', type: 'string' }
    ]
  },
  projects: {
    label: 'Projects',
    fields: [
      { id: 'name', label: 'Project Name', type: 'string' },
      { id: 'client_name', label: 'Client', type: 'string' },
      { id: 'budget', label: 'Budget', type: 'number' },
      { id: 'status', label: 'Status', type: 'string' },
      { id: 'start_date', label: 'Start Date', type: 'date' },
      { id: 'end_date', label: 'End Date', type: 'date' },
      { id: 'completion_percentage', label: 'Completion %', type: 'number' },
      { id: 'created_at', label: 'Created Date', type: 'date' }
    ]
  },
  tasks: {
    label: 'Tasks',
    fields: [
      { id: 'title', label: 'Task Title', type: 'string' },
      { id: 'project_name', label: 'Project', type: 'string' },
      { id: 'status', label: 'Status', type: 'string' },
      { id: 'priority', label: 'Priority', type: 'string' },
      { id: 'assignee_name', label: 'Assignee', type: 'string' },
      { id: 'start_date', label: 'Start Date', type: 'date' },
      { id: 'end_date', label: 'End Date', type: 'date' },
      { id: 'created_at', label: 'Created Date', type: 'date' }
    ]
  },
  time_logs: {
    label: 'Time Logs',
    fields: [
      { id: 'user_name', label: 'Team Member', type: 'string' },
      { id: 'project_name', label: 'Project', type: 'string' },
      { id: 'task_title', label: 'Task', type: 'string' },
      { id: 'duration_minutes', label: 'Duration (mins)', type: 'number' },
      { id: 'billable', label: 'Billable', type: 'boolean' },
      { id: 'date', label: 'Date', type: 'date' }
    ]
  },
  team: {
    label: 'Team Members',
    fields: [
      { id: 'name', label: 'Name', type: 'string' },
      { id: 'email', label: 'Email', type: 'string' },
      { id: 'role', label: 'Role', type: 'string' },
      { id: 'date_of_joining', label: 'Date of Joining', type: 'date' }
    ]
  },
  leaves: {
    label: 'Leave Applications',
    fields: [
      { id: 'user_name', label: 'Employee', type: 'string' },
      { id: 'leave_type', label: 'Leave Type', type: 'string' },
      { id: 'start_date', label: 'Start Date', type: 'date' },
      { id: 'end_date', label: 'End Date', type: 'date' },
      { id: 'days', label: 'Days', type: 'number' },
      { id: 'status', label: 'Status', type: 'string' },
      { id: 'reason', label: 'Reason', type: 'string' }
    ]
  },
  reimbursements: {
    label: 'Reimbursements',
    fields: [
      { id: 'user_name', label: 'Employee', type: 'string' },
      { id: 'category', label: 'Category', type: 'string' },
      { id: 'amount', label: 'Amount', type: 'number' },
      { id: 'date', label: 'Date', type: 'date' },
      { id: 'status', label: 'Status', type: 'string' },
      { id: 'description', label: 'Description', type: 'string' },
      { id: 'project_id', label: 'Project Tagged', type: 'boolean' }
    ]
  },
  fee_structure: {
    label: 'Fee Structure',
    fields: [
      { id: 'stage', label: 'Stage', type: 'string' },
      { id: 'deliverable', label: 'Deliverable', type: 'string' },
      { id: 'percentage', label: 'Percentage', type: 'number' },
      { id: 'amount', label: 'Amount', type: 'number' },
      { id: 'tentative_billing_date', label: 'Billing Date', type: 'date' },
      { id: 'deliverable_status', label: 'Deliverable Status', type: 'string' },
      { id: 'invoice_status', label: 'Invoice Status', type: 'string' },
      { id: 'payment_status', label: 'Payment Status', type: 'string' }
    ]
  }
};

const formatCurrency = (amount) => {
  return `INR ${new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(amount)}`;
};

export const ReportsPage = () => {
  const { user } = useAuth();
  
  // Standard reports data
  const [overview, setOverview] = useState(null);
  const [projectPerformance, setProjectPerformance] = useState([]);
  const [teamProductivity, setTeamProductivity] = useState([]);
  const [loading, setLoading] = useState(true);

  // Custom report builder state
  const [selectedModule, setSelectedModule] = useState('');
  const [selectedFields, setSelectedFields] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [sortConfig, setSortConfig] = useState({ field: null, direction: 'asc' });
  const [filterConfig, setFilterConfig] = useState({ field: '', operator: '', value: '' });
  const [reportName, setReportName] = useState('Custom Report');

  // All raw data for custom reports
  const [allData, setAllData] = useState({});

  const COLORS = ['hsl(180, 84%, 45%)', 'hsl(160, 75%, 40%)', 'hsl(200, 70%, 50%)', 'hsl(140, 65%, 45%)'];

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const [overviewRes, projectsRes, teamRes] = await Promise.all([
          axios.get(`${API_URL}/reports/overview`, { withCredentials: true }),
          axios.get(`${API_URL}/reports/project-performance`, { withCredentials: true }),
          axios.get(`${API_URL}/reports/team-productivity`, { withCredentials: true })
        ]);
        setOverview(overviewRes.data);
        setProjectPerformance(projectsRes.data);
        setTeamProductivity(teamRes.data);
      } catch (error) {
        console.error('Failed to load reports:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  // Fetch data for custom report builder
  const fetchModuleData = async (module) => {
    if (allData[module]) return allData[module];
    
    const endpoints = {
      clients: '/clients',
      companies: '/companies',
      projects: '/projects',
      tasks: '/tasks',
      time_logs: '/time-logs',
      team: '/team',
      leaves: '/leaves',
      reimbursements: '/reimbursements',
      fee_structure: '/fee-structure'
    };
    
    try {
      const response = await axios.get(`${API_URL}${endpoints[module]}`, { withCredentials: true });
      const data = response.data;
      setAllData(prev => ({ ...prev, [module]: data }));
      return data;
    } catch (error) {
      toast.error(`Failed to load ${module} data`);
      return [];
    }
  };

  const handleModuleChange = async (module) => {
    setSelectedModule(module);
    setSelectedFields([]);
    setReportData([]);
    setFilterConfig({ field: '', operator: '', value: '' });
    setSortConfig({ field: null, direction: 'asc' });
  };

  const handleAddField = (fieldId) => {
    if (!selectedFields.includes(fieldId)) {
      setSelectedFields([...selectedFields, fieldId]);
    }
  };

  const handleRemoveField = (fieldId) => {
    setSelectedFields(selectedFields.filter(f => f !== fieldId));
  };

  const handleMoveField = (fromIndex, toIndex) => {
    const newFields = [...selectedFields];
    const [removed] = newFields.splice(fromIndex, 1);
    newFields.splice(toIndex, 0, removed);
    setSelectedFields(newFields);
  };

  const generateReport = async () => {
    if (!selectedModule || selectedFields.length === 0) {
      toast.error('Please select a module and at least one field');
      return;
    }

    setReportLoading(true);
    try {
      const data = await fetchModuleData(selectedModule);
      setReportData(data);
      toast.success('Report generated');
    } catch (error) {
      toast.error('Failed to generate report');
    } finally {
      setReportLoading(false);
    }
  };

  // Filter and sort report data
  const processedReportData = useMemo(() => {
    let data = [...reportData];

    // Apply filter
    if (filterConfig.field && filterConfig.operator && filterConfig.value) {
      data = data.filter(row => {
        const value = row[filterConfig.field];
        const filterValue = filterConfig.value;

        switch (filterConfig.operator) {
          case 'equals':
            return String(value).toLowerCase() === String(filterValue).toLowerCase();
          case 'contains':
            return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
          case 'gt':
            return Number(value) > Number(filterValue);
          case 'lt':
            return Number(value) < Number(filterValue);
          case 'gte':
            return Number(value) >= Number(filterValue);
          case 'lte':
            return Number(value) <= Number(filterValue);
          default:
            return true;
        }
      });
    }

    // Apply sort
    if (sortConfig.field) {
      data.sort((a, b) => {
        const aVal = a[sortConfig.field];
        const bVal = b[sortConfig.field];
        
        if (aVal == null) return 1;
        if (bVal == null) return -1;
        
        const comparison = typeof aVal === 'number' 
          ? aVal - bVal 
          : String(aVal).localeCompare(String(bVal));
        
        return sortConfig.direction === 'asc' ? comparison : -comparison;
      });
    }

    return data;
  }, [reportData, filterConfig, sortConfig]);

  const handleSort = (fieldId) => {
    setSortConfig(prev => ({
      field: fieldId,
      direction: prev.field === fieldId && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Export functions
  const exportToCSV = () => {
    if (processedReportData.length === 0) {
      toast.error('No data to export');
      return;
    }

    const moduleFields = REPORT_MODULES[selectedModule]?.fields || [];
    const headers = selectedFields.map(f => moduleFields.find(mf => mf.id === f)?.label || f);
    
    const csvContent = [
      headers.join(','),
      ...processedReportData.map(row => 
        selectedFields.map(f => {
          const value = row[f];
          if (value == null) return '';
          if (typeof value === 'string' && value.includes(',')) return `"${value}"`;
          return value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported');
  };

  const exportToPDF = async () => {
    if (processedReportData.length === 0) {
      toast.error('No data to export');
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/reports/export-custom-pdf`, {
        report_name: reportName,
        module: selectedModule,
        fields: selectedFields,
        data: processedReportData.slice(0, 100) // Limit to 100 rows for PDF
      }, {
        withCredentials: true,
        responseType: 'blob'
      });

      const url = URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${reportName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('PDF exported');
    } catch (error) {
      toast.error('Failed to export PDF');
    }
  };

  const handleStandardExport = async (endpoint, filename) => {
    try {
      const response = await axios.get(`${API_URL}/reports/export/${endpoint}`, {
        withCredentials: true,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Report exported successfully');
    } catch (error) {
      toast.error('Failed to export report');
    }
  };

  const getFieldLabel = (fieldId) => {
    const moduleFields = REPORT_MODULES[selectedModule]?.fields || [];
    return moduleFields.find(f => f.id === fieldId)?.label || fieldId;
  };

  const formatCellValue = (value, fieldId) => {
    if (value == null) return '-';
    const moduleFields = REPORT_MODULES[selectedModule]?.fields || [];
    const field = moduleFields.find(f => f.id === fieldId);
    
    if (field?.type === 'number' && fieldId.includes('amount') || fieldId === 'budget') {
      return formatCurrency(value);
    }
    if (field?.type === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (field?.type === 'date' && value) {
      return new Date(value).toLocaleDateString('en-IN');
    }
    return String(value);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div data-testid="reports-page" className="pt-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Reports & Analytics</h1>
          <p className="text-base text-muted-foreground">Generate insights and custom reports from your data</p>
        </div>
      </div>

      <Tabs defaultValue="custom-report" className="space-y-6">
        <TabsList>
          <TabsTrigger value="custom-report">Report Builder</TabsTrigger>
          <TabsTrigger value="standard">Standard Reports</TabsTrigger>
        </TabsList>

        {/* Custom Report Builder Tab */}
        <TabsContent value="custom-report" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Field Selection Panel */}
            <Card className="p-4 lg:col-span-1">
              <h3 className="text-lg font-heading font-semibold mb-4 flex items-center gap-2">
                <Settings className="h-5 w-5" /> Data Source
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Module</label>
                  <Select value={selectedModule || '__none__'} onValueChange={(v) => handleModuleChange(v === '__none__' ? '' : v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose data source" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">-- Select Module --</SelectItem>
                      {Object.entries(REPORT_MODULES).map(([key, module]) => (
                        <SelectItem key={key} value={key}>{module.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedModule && (
                  <div>
                    <label className="text-sm font-medium mb-2 block">Available Fields</label>
                    <p className="text-xs text-muted-foreground mb-2">Click to add to report</p>
                    <div className="space-y-1 max-h-64 overflow-y-auto">
                      {REPORT_MODULES[selectedModule]?.fields.map(field => (
                        <button
                          key={field.id}
                          className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                            selectedFields.includes(field.id)
                              ? 'bg-primary/20 text-primary'
                              : 'hover:bg-muted'
                          }`}
                          onClick={() => handleAddField(field.id)}
                          disabled={selectedFields.includes(field.id)}
                        >
                          <div className="flex items-center justify-between">
                            <span>{field.label}</span>
                            {selectedFields.includes(field.id) && (
                              <Badge variant="outline" className="text-xs">Added</Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Report Configuration & Preview */}
            <div className="lg:col-span-3 space-y-4">
              {/* Selected Fields */}
              <Card className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-heading font-semibold flex items-center gap-2">
                    <TableIcon className="h-5 w-5" /> Report Columns
                  </h3>
                  <div className="flex items-center gap-2">
                    <Input 
                      value={reportName}
                      onChange={(e) => setReportName(e.target.value)}
                      className="w-48"
                      placeholder="Report Name"
                    />
                    <Button onClick={generateReport} disabled={reportLoading || selectedFields.length === 0}>
                      <RefreshCw className={`mr-2 h-4 w-4 ${reportLoading ? 'animate-spin' : ''}`} />
                      Generate
                    </Button>
                  </div>
                </div>

                {selectedFields.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    Select fields from the left panel to build your report
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {selectedFields.map((fieldId, idx) => (
                      <Badge 
                        key={fieldId} 
                        variant="secondary" 
                        className="px-3 py-1.5 flex items-center gap-2 cursor-move"
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('fieldIndex', idx.toString())}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={(e) => {
                          const fromIndex = parseInt(e.dataTransfer.getData('fieldIndex'));
                          handleMoveField(fromIndex, idx);
                        }}
                      >
                        <GripVertical className="h-3 w-3 text-muted-foreground" />
                        {getFieldLabel(fieldId)}
                        <button onClick={() => handleRemoveField(fieldId)}>
                          <X className="h-3 w-3 hover:text-destructive" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </Card>

              {/* Filter & Sort */}
              {reportData.length > 0 && (
                <Card className="p-4">
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Filter className="h-4 w-4 text-muted-foreground" />
                      <Select value={filterConfig.field || '__none__'} onValueChange={(v) => setFilterConfig(prev => ({ ...prev, field: v === '__none__' ? '' : v }))}>
                        <SelectTrigger className="w-36">
                          <SelectValue placeholder="Filter by" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No Filter</SelectItem>
                          {selectedFields.map(f => (
                            <SelectItem key={f} value={f}>{getFieldLabel(f)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {filterConfig.field && (
                        <>
                          <Select value={filterConfig.operator || '__none__'} onValueChange={(v) => setFilterConfig(prev => ({ ...prev, operator: v === '__none__' ? '' : v }))}>
                            <SelectTrigger className="w-32">
                              <SelectValue placeholder="Operator" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Select</SelectItem>
                              <SelectItem value="equals">Equals</SelectItem>
                              <SelectItem value="contains">Contains</SelectItem>
                              <SelectItem value="gt">Greater than</SelectItem>
                              <SelectItem value="lt">Less than</SelectItem>
                              <SelectItem value="gte">≥</SelectItem>
                              <SelectItem value="lte">≤</SelectItem>
                            </SelectContent>
                          </Select>
                          <Input 
                            value={filterConfig.value}
                            onChange={(e) => setFilterConfig(prev => ({ ...prev, value: e.target.value }))}
                            className="w-32"
                            placeholder="Value"
                          />
                        </>
                      )}
                    </div>
                    <div className="flex-1"></div>
                    <p className="text-sm text-muted-foreground">
                      {processedReportData.length} of {reportData.length} records
                    </p>
                  </div>
                </Card>
              )}

              {/* Report Preview Table */}
              {processedReportData.length > 0 && (
                <Card className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-heading font-semibold">{reportName}</h3>
                    <div className="flex gap-2">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline">
                            <Download className="mr-2 h-4 w-4" />
                            Export
                            <ChevronDown className="ml-2 h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={exportToCSV}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            Export as CSV
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={exportToPDF}>
                            <FileText className="mr-2 h-4 w-4" />
                            Export as PDF
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {selectedFields.map(fieldId => (
                            <TableHead 
                              key={fieldId}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => handleSort(fieldId)}
                            >
                              <div className="flex items-center gap-1">
                                {getFieldLabel(fieldId)}
                                <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                              </div>
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {processedReportData.slice(0, 50).map((row, idx) => (
                          <TableRow key={idx}>
                            {selectedFields.map(fieldId => (
                              <TableCell key={fieldId}>
                                {formatCellValue(row[fieldId], fieldId)}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                  {processedReportData.length > 50 && (
                    <p className="text-sm text-muted-foreground text-center mt-4">
                      Showing 50 of {processedReportData.length} records. Export for full data.
                    </p>
                  )}
                </Card>
              )}

              {reportData.length === 0 && selectedFields.length > 0 && (
                <Card className="p-12 text-center">
                  <BarChart3 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-xl font-heading font-semibold mb-2">Ready to Generate</h3>
                  <p className="text-muted-foreground">Click "Generate" to create your custom report</p>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Standard Reports Tab */}
        <TabsContent value="standard" className="space-y-6">
          {/* Overview Cards */}
          {overview && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Total Revenue</p>
                    <p className="text-3xl font-bold font-heading">{formatCurrency(overview.total_revenue || 0)}</p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-green-500" />
                </div>
              </Card>
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Active Projects</p>
                    <p className="text-3xl font-bold font-heading">{overview.active_projects || 0}</p>
                  </div>
                  <FileText className="h-8 w-8 text-blue-500" />
                </div>
              </Card>
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Total Hours Logged</p>
                    <p className="text-3xl font-bold font-heading">{overview.total_hours_logged?.toFixed(1) || 0}h</p>
                  </div>
                  <Clock className="h-8 w-8 text-amber-500" />
                </div>
              </Card>
              <Card className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground mb-1">Team Members</p>
                    <p className="text-3xl font-bold font-heading">{overview.team_members || 0}</p>
                  </div>
                  <Users className="h-8 w-8 text-purple-500" />
                </div>
              </Card>
            </div>
          )}

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Project Performance */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-heading font-semibold">Project Performance</h3>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="mr-2 h-4 w-4" />
                      Export
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleStandardExport('projects/csv', 'project_performance.csv')}>
                      CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStandardExport('projects/pdf', 'project_performance.pdf')}>
                      PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {projectPerformance.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={projectPerformance.slice(0, 5)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="completion" fill="hsl(180, 84%, 45%)" name="Completion %" />
                    <Bar dataKey="tasks_completed" fill="hsl(160, 75%, 40%)" name="Tasks Done" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-12">No project data available</p>
              )}
            </Card>

            {/* Team Productivity */}
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-heading font-semibold">Team Productivity</h3>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Download className="mr-2 h-4 w-4" />
                      Export
                      <ChevronDown className="ml-2 h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => handleStandardExport('team/csv', 'team_productivity.csv')}>
                      CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleStandardExport('team/pdf', 'team_productivity.pdf')}>
                      PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {teamProductivity.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={teamProductivity.slice(0, 5)}
                      dataKey="hours_logged"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, value }) => `${name}: ${value.toFixed(1)}h`}
                    >
                      {teamProductivity.slice(0, 5).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-12">No productivity data available</p>
              )}
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
