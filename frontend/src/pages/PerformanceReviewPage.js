import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Plus, Star, User, Calendar, Trash2, Send, Check, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const statusColors = {
  draft: 'bg-gray-500/20 text-gray-600 border-gray-500/30',
  submitted: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
  acknowledged: 'bg-green-500/20 text-green-600 border-green-500/30'
};

export const PerformanceReviewPage = () => {
  const { user } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const canCreateReview = ['admin', 'manager', 'supervisor'].includes(user?.role);

  const [reviewForm, setReviewForm] = useState({
    user_id: '',
    review_period: '',
    overall_rating: 3,
    strengths: '',
    areas_for_improvement: '',
    goals: '',
    comments: ''
  });

  const fetchData = async () => {
    try {
      const [reviewsRes, teamRes] = await Promise.all([
        axios.get(`${API_URL}/performance-reviews`, { withCredentials: true }),
        axios.get(`${API_URL}/team`, { withCredentials: true })
      ]);
      setReviews(reviewsRes.data);
      setTeamMembers(teamRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/performance-reviews`, reviewForm, { withCredentials: true });
      toast.success('Performance review created');
      setIsDialogOpen(false);
      setReviewForm({
        user_id: '', review_period: '', overall_rating: 3,
        strengths: '', areas_for_improvement: '', goals: '', comments: ''
      });
      fetchData();
    } catch (error) {
      toast.error('Failed to create review');
    }
  };

  const handleSubmitReview = async (reviewId) => {
    try {
      await axios.patch(`${API_URL}/performance-reviews/${reviewId}/submit`, {}, { withCredentials: true });
      toast.success('Review submitted');
      fetchData();
    } catch (error) {
      toast.error('Failed to submit review');
    }
  };

  const handleAcknowledgeReview = async (reviewId) => {
    try {
      await axios.patch(`${API_URL}/performance-reviews/${reviewId}/acknowledge`, {}, { withCredentials: true });
      toast.success('Review acknowledged');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to acknowledge review');
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Delete this review?')) return;
    try {
      await axios.delete(`${API_URL}/performance-reviews/${reviewId}`, { withCredentials: true });
      toast.success('Review deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete review');
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-5 w-5 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
          />
        ))}
      </div>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div data-testid="performance-review-page" className="pt-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Performance Reviews</h1>
          <p className="text-base text-muted-foreground">Create and manage employee performance reviews</p>
        </div>
        {canCreateReview && (
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="create-review-btn">
                <Plus className="mr-2 h-4 w-4" />
                Create Review
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Performance Review</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Team Member</label>
                    <Select value={reviewForm.user_id} onValueChange={(value) => setReviewForm({ ...reviewForm, user_id: value })} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select team member" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamMembers.filter(m => m.user_id !== user?.user_id).map((member) => (
                          <SelectItem key={member.user_id} value={member.user_id}>
                            {member.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Review Period</label>
                    <Input
                      value={reviewForm.review_period}
                      onChange={(e) => setReviewForm({ ...reviewForm, review_period: e.target.value })}
                      placeholder="e.g., Q1 2025, Annual 2025"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Overall Rating</label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewForm({ ...reviewForm, overall_rating: star })}
                        className="p-1 hover:scale-110 transition-transform"
                      >
                        <Star
                          className={`h-8 w-8 ${star <= reviewForm.overall_rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'}`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 text-lg font-semibold">{reviewForm.overall_rating}/5</span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Strengths</label>
                  <Textarea
                    value={reviewForm.strengths}
                    onChange={(e) => setReviewForm({ ...reviewForm, strengths: e.target.value })}
                    rows={3}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Areas for Improvement</label>
                  <Textarea
                    value={reviewForm.areas_for_improvement}
                    onChange={(e) => setReviewForm({ ...reviewForm, areas_for_improvement: e.target.value })}
                    rows={3}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Goals for Next Period</label>
                  <Textarea
                    value={reviewForm.goals}
                    onChange={(e) => setReviewForm({ ...reviewForm, goals: e.target.value })}
                    rows={3}
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Additional Comments</label>
                  <Textarea
                    value={reviewForm.comments}
                    onChange={(e) => setReviewForm({ ...reviewForm, comments: e.target.value })}
                    rows={2}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                  <Button type="submit">Create Review</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {reviews.length === 0 ? (
        <Card className="p-12 text-center">
          <Star className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-heading font-semibold mb-2">No performance reviews</h3>
          <p className="text-muted-foreground">
            {canCreateReview ? 'Create a new review to get started' : 'No reviews available for you yet'}
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {reviews.map((review) => (
            <Card key={review.review_id} className="p-6" data-testid={`review-${review.review_id}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-heading font-semibold">{review.user_name}</h3>
                  <p className="text-sm text-muted-foreground">{review.review_period}</p>
                </div>
                <Badge className={`${statusColors[review.status]} border`}>
                  {review.status}
                </Badge>
              </div>
              
              <div className="mb-4">
                {renderStars(review.overall_rating)}
              </div>
              
              <div className="text-sm text-muted-foreground mb-4">
                <p>Reviewed by: {review.reviewer_name}</p>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" onClick={() => {
                  setSelectedReview(review);
                  setIsViewDialogOpen(true);
                }}>
                  <FileText className="mr-1 h-3 w-3" />
                  View
                </Button>
                
                {review.status === 'draft' && review.reviewer_id === user?.user_id && (
                  <Button size="sm" onClick={() => handleSubmitReview(review.review_id)}>
                    <Send className="mr-1 h-3 w-3" />
                    Submit
                  </Button>
                )}
                
                {review.status === 'submitted' && review.user_id === user?.user_id && (
                  <Button size="sm" onClick={() => handleAcknowledgeReview(review.review_id)}>
                    <Check className="mr-1 h-3 w-3" />
                    Acknowledge
                  </Button>
                )}
                
                {user?.role === 'admin' && (
                  <Button size="sm" variant="ghost" onClick={() => handleDeleteReview(review.review_id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* View Review Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Performance Review Details</DialogTitle>
          </DialogHeader>
          {selectedReview && (
            <div className="space-y-6">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
                <div>
                  <h3 className="text-xl font-heading font-semibold">{selectedReview.user_name}</h3>
                  <p className="text-sm text-muted-foreground">{selectedReview.review_period}</p>
                </div>
                <div className="text-right">
                  {renderStars(selectedReview.overall_rating)}
                  <p className="text-sm text-muted-foreground mt-1">By: {selectedReview.reviewer_name}</p>
                </div>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-green-600 mb-2">Strengths</h4>
                <p className="text-sm whitespace-pre-wrap">{selectedReview.strengths}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-amber-600 mb-2">Areas for Improvement</h4>
                <p className="text-sm whitespace-pre-wrap">{selectedReview.areas_for_improvement}</p>
              </div>
              
              <div>
                <h4 className="text-sm font-semibold text-blue-600 mb-2">Goals for Next Period</h4>
                <p className="text-sm whitespace-pre-wrap">{selectedReview.goals}</p>
              </div>
              
              {selectedReview.comments && (
                <div>
                  <h4 className="text-sm font-semibold mb-2">Additional Comments</h4>
                  <p className="text-sm whitespace-pre-wrap">{selectedReview.comments}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
